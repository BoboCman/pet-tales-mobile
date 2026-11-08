import { v2 as cloudinary } from "cloudinary"
import { stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/postmark"
import { accountDeletedEmail } from "@/lib/email/templates"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Deletes a user's account (server only). Used by Settings and by Admin → Users.
 *
 * Order matters: billing is stopped first, and if Stripe can't be reached nothing else happens,
 * so we never end up with a deleted account that is still being charged.
 *
 *  1. Cancel every live Stripe subscription now (no refund; Stripe customer and invoices are kept
 *     for accounting).
 *  2. Delete private tales (rows + their files). Public tales stay up at their links, as the
 *     Privacy Policy says; their raw upload and narration file are still removed.
 *  3. Delete pets that no remaining tale uses.
 *  4. Anonymise the public.users row (it is kept so public tales and the credit ledger still
 *     point somewhere) and zero the balance.
 *  5. Delete the login (auth.users). The same email can sign up again later as a new account.
 */

export type DeleteAccountResult = {
  success: boolean
  error?: string
  cancelledSubscriptions: number
  deletedTales: number
  keptPublicTales: number
  deletedPets: number
  problems: string[]
}

const LIVE_SUBSCRIPTION = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"])

/** "…/storage/v1/object/public/<bucket>/<path>" → { bucket, path } */
function storageObject(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/)
  return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null
}

async function removeStorageFiles(urls: Array<string | null | undefined>, problems: string[]) {
  const byBucket = new Map<string, string[]>()
  for (const url of urls) {
    const obj = storageObject(url)
    if (!obj) continue
    byBucket.set(obj.bucket, [...(byBucket.get(obj.bucket) ?? []), obj.path])
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) problems.push(`storage ${bucket}: ${error.message}`)
    }
  }
}

async function cancelStripe(customerId: string | null, subscriptionId: string | null): Promise<number> {
  const ids = new Set<string>()
  if (customerId) {
    try {
      const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })
      for (const sub of list.data) if (LIVE_SUBSCRIPTION.has(sub.status)) ids.add(sub.id)
    } catch (error: any) {
      // A customer from the old, shared Stripe account doesn't exist here: nothing to cancel
      if (!(error?.code === "resource_missing" || error?.statusCode === 404)) throw error
    }
  }
  if (subscriptionId && !ids.has(subscriptionId)) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      if (LIVE_SUBSCRIPTION.has(sub.status)) ids.add(sub.id)
    } catch (error: any) {
      if (!(error?.code === "resource_missing" || error?.statusCode === 404)) throw error
    }
  }
  for (const id of ids) {
    await stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false })
  }
  return ids.size
}

export async function deleteAccount(userId: string, actor: { type: "self" | "admin"; adminId?: string }): Promise<DeleteAccountResult> {
  const result: DeleteAccountResult = {
    success: false,
    cancelledSubscriptions: 0,
    deletedTales: 0,
    keptPublicTales: 0,
    deletedPets: 0,
    problems: [],
  }

  const { data: user } = await supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle()
  if (!user) return { ...result, error: "Account not found" }
  if (user.is_admin) return { ...result, error: "Admin accounts can't be deleted here" }

  // 1. Stop billing first. If this fails, stop: better a delayed deletion than charging a deleted account.
  try {
    result.cancelledSubscriptions = await cancelStripe(user.stripe_customer_id ?? null, user.stripe_subscription_id ?? null)
  } catch (error: any) {
    console.error("[delete-account] Stripe cancel failed:", error)
    return { ...result, error: "Couldn't cancel the plan in Stripe, so nothing was deleted. Please try again." }
  }

  // Goodbye email while we still have the address (never blocks the deletion)
  try {
    const name = (user.full_name as string | null)?.trim().split(/\s+/)[0] || null
    await sendEmail({
      to: user.email,
      userId: user.id,
      template: "account_deleted",
      dedupeKey: `account_deleted:${user.id}`,
      metadata: { by: actor.type },
      ...accountDeletedEmail({ name, planCancelled: result.cancelledSubscriptions > 0 }),
    })
  } catch (error) {
    console.error("[delete-account] goodbye email failed (non-fatal):", error)
  }

  // 2. Tales
  const { data: entries } = await supabaseAdmin
    .from("diary_entries")
    .select("id, pet_id, is_public, video_url, voiceover_url, merged_video_url, merged_video_supabase_url, merged_video_public_id")
    .eq("user_id", userId)
  const tales = entries ?? []
  const privateTales = tales.filter((t: any) => t.is_public !== true)
  const publicTales = tales.filter((t: any) => t.is_public === true)

  // Raw uploads and narration files are only needed to make a tale. Remove them for every private
  // tale, and for public tales that have a finished video (otherwise the raw upload is what plays).
  await removeStorageFiles(
    tales.flatMap((t: any) => {
      const finished = Boolean(t.merged_video_supabase_url || t.merged_video_url)
      return t.is_public === true && !finished ? [] : [t.video_url, t.voiceover_url]
    }),
    result.problems,
  )

  for (const tale of privateTales as any[]) {
    await supabaseAdmin.from("diary_entry_likes").delete().eq("diary_entry_id", tale.id)
    await supabaseAdmin.from("view_logs").delete().eq("diary_entry_id", tale.id)
    const { error } = await supabaseAdmin.from("diary_entries").delete().eq("id", tale.id)
    if (error) {
      result.problems.push(`tale ${tale.id}: ${error.message}`)
      continue
    }
    result.deletedTales++
    await removeStorageFiles([tale.merged_video_supabase_url], result.problems)
    if (tale.merged_video_public_id) {
      try {
        await cloudinary.uploader.destroy(tale.merged_video_public_id, { resource_type: "video", invalidate: true })
      } catch (error) {
        result.problems.push(`cloudinary ${tale.id}`)
      }
    }
  }
  result.keptPublicTales = publicTales.length

  // 3. Pets no remaining tale uses
  const keptPetIds = new Set(publicTales.map((t: any) => t.pet_id).filter(Boolean))
  const { data: pets } = await supabaseAdmin.from("pets").select("*").eq("user_id", userId)
  for (const pet of (pets ?? []) as any[]) {
    if (keptPetIds.has(pet.id)) continue
    const { error } = await supabaseAdmin.from("pets").delete().eq("id", pet.id)
    if (error) {
      result.problems.push(`pet ${pet.id}: ${error.message}`)
      continue
    }
    result.deletedPets++
    await removeStorageFiles([pet.avatar_url, pet.photo_url, pet.image_url], result.problems)
  }

  // 4. Anonymise the profile row and zero the balance
  const balance = (user.free_credits || 0) + (user.purchased_credits || 0)
  const { error: anonError } = await supabaseAdmin
    .from("users")
    .update({
      email: `deleted-${user.id}@deleted.pettaleai.com`,
      free_credits: 0,
      purchased_credits: 0,
      subscription_status: result.cancelledSubscriptions > 0 ? "canceled" : user.subscription_status,
      marketing_opt_in: false,
      email_suppressed: true,
      email_suppressed_reason: "account_deleted",
    })
    .eq("id", user.id)
  if (anonError) {
    console.error("[delete-account] anonymise failed:", anonError)
    return { ...result, error: "Couldn't remove the profile. Please try again." }
  }
  // Optional columns (not every database has all of them)
  for (const column of ["full_name", "username", "avatar_url", "bio"]) {
    if (column in user) await supabaseAdmin.from("users").update({ [column]: null }).eq("id", user.id)
  }
  if (balance > 0) {
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: user.id,
      amount: -balance,
      transaction_type: "adjustment",
      metadata: { reason: "account_deleted", by: actor.type, admin_id: actor.adminId ?? null },
    })
  }

  // 5. Remove the login
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (authError && !/not.?found/i.test(authError.message)) {
    console.error("[delete-account] auth delete failed:", authError)
    return { ...result, error: "Couldn't remove the login. Please try again." }
  }

  if (result.problems.length) console.warn("[delete-account] finished with problems:", result.problems)
  return { ...result, success: true }
}
