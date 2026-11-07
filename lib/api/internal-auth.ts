import { timingSafeEqual } from "crypto"

/**
 * Shared-secret auth for server-to-server calls between our own API routes
 * (n8n-direct -> tts/compress, Cloudinary webhooks -> merged-video, ...).
 *
 * These routes spend ElevenLabs and Cloudinary money and overwrite a tale's audio/video, so they
 * must not be callable from the internet. Uses INTERNAL_API_SECRET, falling back to the existing
 * N8N_WEBHOOK_SECRET so no new Vercel variable is required.
 */
function getInternalSecret(): string {
  return (process.env.INTERNAL_API_SECRET || process.env.N8N_WEBHOOK_SECRET || "").trim()
}

/** Headers to send on an internal call */
export function internalAuthHeaders(): Record<string, string> {
  return { "X-Internal-Secret": getInternalSecret() }
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

/**
 * True when the request carries the internal secret. Also accepts the X-Webhook-Secret header
 * that n8n-direct already sends. Fails closed when no secret is configured.
 */
export function isInternalRequest(request: Request): boolean {
  const secret = getInternalSecret()
  if (!secret) {
    console.error("[internal-auth] INTERNAL_API_SECRET / N8N_WEBHOOK_SECRET is not configured; rejecting")
    return false
  }
  const provided = request.headers.get("x-internal-secret") || request.headers.get("x-webhook-secret") || ""
  return provided.length > 0 && safeEqual(provided.trim(), secret)
}
