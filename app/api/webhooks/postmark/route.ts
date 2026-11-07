import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * Postmark webhook: delivery, open, click, bounce, spam complaint and unsubscribe events.
 * Updates the matching email_log row (by MessageID) and stops sending to addresses that hard
 * bounced, complained or unsubscribed.
 *
 * Auth: HTTP Basic auth set on the webhook in Postmark, checked against
 * POSTMARK_WEBHOOK_USERNAME / POSTMARK_WEBHOOK_PASSWORD. Fails closed when they are not set.
 */

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

function isAuthorized(request: Request): boolean {
  const username = process.env.POSTMARK_WEBHOOK_USERNAME?.trim()
  const password = process.env.POSTMARK_WEBHOOK_PASSWORD?.trim()
  if (!username || !password) {
    console.error("[postmark-webhook] POSTMARK_WEBHOOK_USERNAME / PASSWORD not set; rejecting")
    return false
  }
  const header = request.headers.get("authorization") || ""
  if (!header.startsWith("Basic ")) return false
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8")
  return safeEqual(decoded, `${username}:${password}`)
}

async function suppress(email: string | undefined, reason: string) {
  if (!email) return
  const { error } = await supabaseAdmin
    .from("users")
    .update({ email_suppressed: true, email_suppressed_reason: reason })
    .ilike("email", email.trim())
  if (error) console.error("[postmark-webhook] Could not suppress", email, error)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const event = await request.json().catch(() => null)
  if (!event?.RecordType) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const messageId: string | undefined = event.MessageID
  const { data: row } = messageId
    ? await supabaseAdmin
        .from("email_log")
        .select("id, open_count, click_count, first_opened_at, first_clicked_at")
        .eq("postmark_message_id", messageId)
        .maybeSingle()
    : { data: null }

  const update: Record<string, unknown> = {}

  switch (event.RecordType) {
    case "Delivery":
      update.status = "delivered"
      update.delivered_at = event.DeliveredAt ?? new Date().toISOString()
      break
    case "Open":
      update.open_count = (row?.open_count ?? 0) + 1
      if (!row?.first_opened_at) update.first_opened_at = event.ReceivedAt ?? new Date().toISOString()
      break
    case "Click":
      update.click_count = (row?.click_count ?? 0) + 1
      if (!row?.first_clicked_at) update.first_clicked_at = event.ReceivedAt ?? new Date().toISOString()
      break
    case "Bounce":
      update.status = "bounced"
      update.bounced_at = event.BouncedAt ?? new Date().toISOString()
      update.error = `${event.Type ?? "Bounce"}: ${event.Description ?? ""}`.trim()
      // Soft bounces (full inbox etc.) can recover; only stop on permanent failures
      if (event.Type === "HardBounce" || event.Inactive === true) await suppress(event.Email, `bounce:${event.Type}`)
      break
    case "SpamComplaint":
      update.status = "spam"
      update.spam_complaint_at = event.BouncedAt ?? new Date().toISOString()
      await suppress(event.Email, "spam_complaint")
      break
    case "SubscriptionChange":
      if (event.SuppressSending) {
        await suppress(event.Recipient, `unsubscribed:${event.SuppressionReason ?? "manual"}`)
      } else if (event.Recipient) {
        // Reactivated in Postmark
        await supabaseAdmin
          .from("users")
          .update({ email_suppressed: false, email_suppressed_reason: null })
          .ilike("email", String(event.Recipient).trim())
      }
      break
    default:
      return NextResponse.json({ received: true, ignored: event.RecordType })
  }

  if (row && Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from("email_log").update(update).eq("id", row.id)
    if (error) {
      console.error("[postmark-webhook] Could not update email_log:", error)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true, matched: !!row })
}
