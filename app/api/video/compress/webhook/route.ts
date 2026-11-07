import crypto from "crypto"
import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { getAppBaseUrl } from "@/lib/utils/app-url"
import { internalAuthHeaders } from "@/lib/api/internal-auth"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

type CompressionNotification = {
  notification_type?: string
  public_id?: string
  error?: unknown
  eager?: Array<{ secure_url?: string; url?: string; format?: string; bytes?: number }>
}

// Cloudinary signs notifications with sha1 or sha256 depending on the account's signature algorithm
// setting, while the SDK helper only checks sha1. Each failure path logs why it failed.
function verifyCloudinarySignature(rawBody: string, request: NextRequest): boolean {
  const timestamp = request.headers.get("x-cld-timestamp")
  const signature = request.headers.get("x-cld-signature")

  if (!timestamp || !signature) {
    console.error("Compress webhook: missing signature headers", {
      hasTimestamp: !!timestamp,
      hasSignature: !!signature,
      contentType: request.headers.get("content-type"),
      userAgent: request.headers.get("user-agent"),
    })
    return false
  }

  const ageSeconds = Math.round(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(ageSeconds) || ageSeconds > 7200) {
    console.error("Compress webhook: timestamp invalid or expired", { timestamp, ageSeconds })
    return false
  }

  const secret = (process.env.CLOUDINARY_API_SECRET ?? "").trim()
  for (const algorithm of ["sha1", "sha256"] as const) {
    const expected = crypto
      .createHash(algorithm)
      .update(rawBody + timestamp + secret)
      .digest("hex")
    if (
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      return true
    }
  }

  console.error("Compress webhook: signature mismatch", {
    receivedSignatureLength: signature.length, // 40 = sha1, 64 = sha256
    bodyLength: rawBody.length,
    secretLength: secret.length,
    ageSeconds,
  })
  return false
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifyCloudinarySignature(rawBody, request)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: CompressionNotification
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const publicId = payload.public_id
  if (!publicId) {
    return NextResponse.json({ error: "Missing public_id" }, { status: 400 })
  }

  const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const compressedUrl = payload.eager?.[0]?.secure_url

  if (!compressedUrl) {
    // Cloudinary also sends a notification for the raw upload itself; the entry keeps
    // using the original video until the eager transformation reports back.
    if (payload.error) {
      console.error("Compress webhook: Cloudinary reported an error for", publicId, payload.error)
      await supabase
        .from("diary_entries")
        .update({ compression_status: "failed", compression_error: JSON.stringify(payload.error).slice(0, 500) })
        .eq("cloudinary_public_id", publicId)
    } else {
      console.log("Compress webhook: no eager secure_url yet for", publicId, "type:", payload.notification_type)
    }
    return NextResponse.json({ received: true, updated: false })
  }

  const { data: entry, error: findError } = await supabase
    .from("diary_entries")
    .select("id, tts_status, voiceover_url, merged_video_status")
    .eq("cloudinary_public_id", publicId)
    .maybeSingle()

  if (findError) {
    console.error("Compress webhook: entry lookup failed:", findError)
    return NextResponse.json({ error: "Entry lookup failed" }, { status: 500 })
  }

  if (!entry) {
    // Acknowledge so Cloudinary does not keep retrying for an entry that no longer exists.
    console.warn("Compress webhook: no diary entry for public_id", publicId)
    return NextResponse.json({ received: true, updated: false })
  }

  const { error: updateError } = await supabase
    .from("diary_entries")
    .update({
      optimized_video_url: compressedUrl,
      compression_status: "completed",
      compression_completed_at: new Date().toISOString(),
      compression_error: null,
    })
    .eq("id", entry.id)

  if (updateError) {
    console.error("Compress webhook: failed to save compressed URL:", updateError)
    return NextResponse.json({ error: "Database update failed" }, { status: 500 })
  }

  console.log("Compress webhook: saved compressed URL for entry", entry.id)

  // The compress route used to trigger the merge right after compression; now that compression
  // finishes here, keep the same trigger conditions.
  if (
    entry.tts_status === "completed" &&
    entry.voiceover_url &&
    (!entry.merged_video_status ||
      entry.merged_video_status === "pending" ||
      entry.merged_video_status === "not_requested")
  ) {
    try {
      const mergeResponse = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
        body: JSON.stringify({ entryId: entry.id }),
      })
      if (!mergeResponse.ok) {
        console.error("Compress webhook: failed to trigger merge:", await mergeResponse.text())
      }
    } catch (triggerError) {
      console.error("Compress webhook: error triggering merge:", triggerError)
    }
  }

  return NextResponse.json({ received: true, updated: true, entryId: entry.id })
}
