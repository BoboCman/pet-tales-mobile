import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendEmail, type SendEmailResult } from "./postmark"
import { subscriptionThanksEmail, taleGiftedEmail, taleReadyEmail, welcomeEmail } from "./templates"
import { isPersonalized } from "@/lib/pets/personality"

/** The app's emails (server only). Each one is safe to call more than once. */

async function getRecipient(userId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, email, full_name, username")
    .eq("id", userId)
    .maybeSingle()
  if (!data?.email) return null
  // Use a first name only when we have a real one; usernames often look like "jane_123"
  const name = data.full_name?.trim().split(/\s+/)[0] || null
  return { id: data.id as string, email: data.email as string, name }
}

export async function sendWelcomeEmail(userId: string): Promise<SendEmailResult> {
  const user = await getRecipient(userId)
  if (!user) return { sent: false, skipped: "no user or email" }
  return sendEmail({
    to: user.email,
    userId: user.id,
    template: "welcome",
    dedupeKey: `welcome:${user.id}`,
    ...welcomeEmail({ name: user.name }),
  })
}

export async function sendTaleReadyEmail(entryId: string): Promise<SendEmailResult> {
  const { data: entry } = await supabaseAdmin
    .from("diary_entries")
    .select("id, user_id, pets:pet_id ( id, name, type, personality_energy, personality_sociability, personality_confidence, personality_obedience, personality_play_style, personality_curiosity, personality_territorial )")
    .eq("id", entryId)
    .maybeSingle()
  if (!entry?.user_id) return { sent: false, skipped: "no entry" }

  const user = await getRecipient(entry.user_id)
  if (!user) return { sent: false, skipped: "no user or email" }

  const pet = Array.isArray((entry as any).pets) ? (entry as any).pets[0] : (entry as any).pets
  return sendEmail({
    to: user.email,
    userId: user.id,
    template: "tale_ready",
    dedupeKey: `tale_ready:${entryId}`,
    metadata: { entry_id: entryId },
    ...taleReadyEmail({
      name: user.name,
      petName: pet?.name ?? null,
      entryId,
      personalizePetId: pet?.id && !isPersonalized(pet) ? pet.id : null,
    }),
  })
}

export async function sendTaleGiftedEmail(
  userId: string,
  tales: number,
  note: string | null,
  giftId: string,
): Promise<SendEmailResult> {
  const user = await getRecipient(userId)
  if (!user) return { sent: false, skipped: "no user or email" }
  return sendEmail({
    to: user.email,
    userId: user.id,
    template: "tale_gifted",
    dedupeKey: `tale_gifted:${giftId}`,
    metadata: { tales },
    ...taleGiftedEmail({ name: user.name, tales, note }),
  })
}

/** Thank-you when someone starts a plan (once per subscription) */
export async function sendSubscriptionThanksEmail(
  userId: string,
  subscriptionId: string,
  plan: { name: string; talesPerMonth: number },
): Promise<SendEmailResult> {
  const user = await getRecipient(userId)
  if (!user) return { sent: false, skipped: "no user or email" }
  return sendEmail({
    to: user.email,
    userId: user.id,
    template: "subscription_thanks",
    dedupeKey: `subscription_thanks:${subscriptionId}`,
    metadata: { subscription_id: subscriptionId, plan: plan.name },
    ...subscriptionThanksEmail({ name: user.name, planName: plan.name, talesPerMonth: plan.talesPerMonth }),
  })
}
