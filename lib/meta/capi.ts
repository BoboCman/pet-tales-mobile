import { createHash } from "crypto"
import { ADS_OPT_OUT_COOKIE, META_PIXEL_ID, type MetaEventName } from "@/lib/meta/shared"

/**
 * Meta Conversions API: sends signups and purchases from the server, so they count even when an
 * ad blocker or iOS privacy blocks the browser pixel. Each event carries the same event_id as its
 * browser twin (when there is one) so Meta counts it once.
 *
 * Needs NEXT_PUBLIC_META_PIXEL_ID and META_CAPI_ACCESS_TOKEN (Vercel only, never in code).
 * META_TEST_EVENT_CODE (optional) routes events to Events Manager > Test events while you check.
 * Never throws: tracking must not break signup or checkout.
 */

const GRAPH_VERSION = "v21.0"

export type MetaContext = {
  ip?: string | null
  userAgent?: string | null
  fbp?: string | null
  fbc?: string | null
  sourceUrl?: string | null
}

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex")

export function metaServerEnabled() {
  return Boolean(META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN)
}

function readCookie(header: string | null, name: string) {
  const m = header?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

/** True when this visitor may be tracked: not opted out, no Global Privacy Control signal */
export function trackingAllowed(request: Request) {
  if (request.headers.get("sec-gpc") === "1") return false
  return readCookie(request.headers.get("cookie"), ADS_OPT_OUT_COOKIE) !== "1"
}

/** What Meta needs to match an event to an ad click, read from the incoming request */
export function metaContextFromRequest(request: Request): MetaContext {
  const cookie = request.headers.get("cookie")
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
    fbp: readCookie(cookie, "_fbp"),
    fbc: readCookie(cookie, "_fbc"),
    sourceUrl: request.headers.get("referer"),
  }
}

/** Checkout metadata that lets the Stripe webhook send the Purchase later (Stripe limits values to 500 chars) */
export function metaCheckoutMetadata(request: Request): Record<string, string> {
  if (!META_PIXEL_ID || !trackingAllowed(request)) return { meta_ok: "0" }
  const c = metaContextFromRequest(request)
  const out: Record<string, string> = { meta_ok: "1" }
  if (c.ip) out.meta_ip = c.ip.slice(0, 100)
  if (c.userAgent) out.meta_ua = c.userAgent.slice(0, 490)
  if (c.fbp) out.meta_fbp = c.fbp.slice(0, 200)
  if (c.fbc) out.meta_fbc = c.fbc.slice(0, 300)
  return out
}

export function metaContextFromMetadata(metadata: Record<string, string> | null | undefined): MetaContext | null {
  if (!metadata || metadata.meta_ok !== "1") return null
  return { ip: metadata.meta_ip, userAgent: metadata.meta_ua, fbp: metadata.meta_fbp, fbc: metadata.meta_fbc }
}

export async function sendMetaEvent(event: {
  name: MetaEventName
  eventId: string
  context: MetaContext
  email?: string | null
  userId?: string | null
  value?: number
  currency?: string
  contentName?: string
}) {
  if (!metaServerEnabled()) return
  const userData: Record<string, unknown> = {}
  if (event.email) userData.em = [sha256(event.email)]
  if (event.userId) userData.external_id = [sha256(event.userId)]
  if (event.context.ip) userData.client_ip_address = event.context.ip
  if (event.context.userAgent) userData.client_user_agent = event.context.userAgent
  if (event.context.fbp) userData.fbp = event.context.fbp
  if (event.context.fbc) userData.fbc = event.context.fbc

  const customData: Record<string, unknown> = {}
  if (event.value != null) {
    customData.value = event.value
    customData.currency = (event.currency || "usd").toUpperCase()
  }
  if (event.contentName) customData.content_name = event.contentName

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        ...(event.context.sourceUrl ? { event_source_url: event.context.sourceUrl } : {}),
        user_data: userData,
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
  }
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(
        process.env.META_CAPI_ACCESS_TOKEN!,
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      },
    )
    if (!res.ok) console.error(`[Meta CAPI] ${event.name} rejected:`, res.status, (await res.text()).slice(0, 300))
  } catch (error) {
    console.error(`[Meta CAPI] ${event.name} failed:`, error)
  }
}
