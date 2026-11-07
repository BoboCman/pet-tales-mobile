import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * Sending email through Postmark (server only).
 *
 * Every send is logged in public.email_log first. The optional dedupeKey has a unique index, so the
 * same email (e.g. "welcome:<user id>") can never go out twice, even if two requests race. The
 * Postmark webhook (/api/webhooks/postmark) later fills in delivered/opened/clicked/bounced on the
 * same row, matched by postmark_message_id.
 *
 * Env vars:
 *   POSTMARK_SERVER_TOKEN  Server API token of the PetTaleAI server in Postmark (required to send)
 *   EMAIL_FROM             Default "Pet Tale AI <hello@pettaleai.com>"
 *   EMAIL_REPLY_TO         Default "pettaleai@gmail.com"
 * Without POSTMARK_SERVER_TOKEN nothing is sent and the row is marked "skipped", so the app never
 * breaks because email isn't set up.
 */

export type EmailStream = "outbound" | "broadcast"

export interface SendEmailInput {
  to: string
  userId?: string | null
  template: string
  subject: string
  html: string
  text: string
  /** Same key = same email; a second send with it is skipped */
  dedupeKey?: string
  /** "outbound" = transactional (default). "broadcast" = marketing, needs the Broadcasts stream. */
  stream?: EmailStream
  metadata?: Record<string, unknown>
  /** Extra headers, e.g. List-Unsubscribe for marketing */
  headers?: Record<string, string>
}

export interface SendEmailResult {
  sent: boolean
  skipped?: string
  messageId?: string
  error?: string
}

const POSTMARK_URL = "https://api.postmarkapp.com/email"

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const stream: EmailStream = input.stream ?? "outbound"

  // Don't send to people who bounced, complained or unsubscribed
  if (input.userId) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email_suppressed, marketing_opt_in")
      .eq("id", input.userId)
      .maybeSingle()
    if (user?.email_suppressed) return { sent: false, skipped: "suppressed" }
    if (stream === "broadcast" && !user?.marketing_opt_in) return { sent: false, skipped: "no marketing consent" }
  }

  // Claim the send. A duplicate dedupe key fails here and nothing goes out.
  const { data: row, error: logError } = await supabaseAdmin
    .from("email_log")
    .insert({
      user_id: input.userId ?? null,
      to_email: input.to,
      template: input.template,
      dedupe_key: input.dedupeKey ?? null,
      stream,
      subject: input.subject,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single()

  if (logError) {
    if (logError.code === "23505") return { sent: false, skipped: "already sent" }
    console.error("[email] Could not log email, not sending:", logError)
    return { sent: false, error: logError.message }
  }

  const token = process.env.POSTMARK_SERVER_TOKEN?.trim()
  if (!token) {
    await supabaseAdmin.from("email_log").update({ status: "skipped", error: "POSTMARK_SERVER_TOKEN not set" }).eq("id", row.id)
    // Let a later attempt send it once Postmark is configured
    if (input.dedupeKey) await supabaseAdmin.from("email_log").update({ dedupe_key: null }).eq("id", row.id)
    console.warn(`[email] POSTMARK_SERVER_TOKEN not set; skipped ${input.template} to ${input.to}`)
    return { sent: false, skipped: "not configured" }
  }

  try {
    const res = await fetch(POSTMARK_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({
        From: process.env.EMAIL_FROM?.trim() || "Pet Tale AI <hello@pettaleai.com>",
        ReplyTo: process.env.EMAIL_REPLY_TO?.trim() || "pettaleai@gmail.com",
        To: input.to,
        Subject: input.subject,
        HtmlBody: input.html,
        TextBody: input.text,
        Tag: input.template,
        MessageStream: stream,
        TrackOpens: true,
        TrackLinks: "HtmlAndText",
        Metadata: { email_log_id: row.id, template: input.template, ...(input.userId ? { user_id: input.userId } : {}) },
        Headers: Object.entries(input.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
      }),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok || body.ErrorCode) {
      const message = `${body.ErrorCode ?? res.status}: ${body.Message ?? "Postmark error"}`
      await supabaseAdmin.from("email_log").update({ status: "failed", error: message }).eq("id", row.id)
      // Free the key so a retry can send it
      if (input.dedupeKey) await supabaseAdmin.from("email_log").update({ dedupe_key: null }).eq("id", row.id)
      console.error(`[email] Postmark rejected ${input.template} to ${input.to}:`, message)
      return { sent: false, error: message }
    }

    await supabaseAdmin
      .from("email_log")
      .update({ status: "sent", postmark_message_id: body.MessageID, sent_at: new Date().toISOString() })
      .eq("id", row.id)
    return { sent: true, messageId: body.MessageID }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await supabaseAdmin.from("email_log").update({ status: "failed", error: message, dedupe_key: null }).eq("id", row.id)
    console.error(`[email] Send failed for ${input.template} to ${input.to}:`, error)
    return { sent: false, error: message }
  }
}
