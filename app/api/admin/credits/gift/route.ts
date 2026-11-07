import { NextResponse } from "next/server"
import { requireAdmin, withRateLimit } from "@/lib/api/auth-middleware"
import { adminRateLimiter } from "@/lib/api/rate-limits"
import { logAdminAction } from "@/lib/api/audit-logger"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendTaleGiftedEmail } from "@/lib/email/send"
import type { AdminContext } from "@/lib/api/types"

/**
 * Gift tales to a user (e.g. they weren't happy with a tale). Gifted tales go to
 * purchased_credits, so they never expire and survive the monthly plan reset.
 * Optionally emails the user with an optional personal note.
 */
const handler = requireAdmin(async (request: Request, context: AdminContext) => {
  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === "string" ? body.userId : ""
  const tales = Number.parseInt(String(body.tales ?? 1), 10)
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null
  const notify = body.notify === true

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  if (!Number.isFinite(tales) || tales < 1 || tales > 20) {
    return NextResponse.json({ error: "Gift between 1 and 20 tales" }, { status: 400 })
  }
  if (reason.length < 3) return NextResponse.json({ error: "Add a short reason" }, { status: 400 })

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, purchased_credits, free_credits")
    .eq("id", userId)
    .maybeSingle()
  if (userError || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ purchased_credits: (user.purchased_credits || 0) + tales })
    .eq("id", user.id)
  if (updateError) {
    console.error("[admin-gift] update error:", updateError)
    return NextResponse.json({ error: "Failed to add tales" }, { status: 500 })
  }

  const { data: tx, error: txError } = await supabaseAdmin
    .from("credit_transactions")
    .insert({
      user_id: user.id,
      amount: tales,
      transaction_type: "grant",
      metadata: {
        admin_action: true,
        gift: true,
        reason,
        note,
        notified: notify,
        admin_email: context.adminEmail,
      },
    })
    .select("id")
    .single()
  if (txError) console.error("[admin-gift] transaction log error:", txError)

  let email: unknown = null
  if (notify) {
    email = await sendTaleGiftedEmail(user.id, tales, note, tx?.id ?? `${user.id}:${Date.now()}`)
  }

  await logAdminAction(context.userId, "gift_tales", { targetUserId: user.id, tales, reason, notify })

  const newTotal = (user.free_credits || 0) + (user.purchased_credits || 0) + tales
  return NextResponse.json({ success: true, newTotal, email })
})

export const POST = withRateLimit(adminRateLimiter, handler)
