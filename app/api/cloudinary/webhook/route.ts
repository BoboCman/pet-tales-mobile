export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"
import { readyEagerUrl } from "@/lib/cloudinary-eager"
import { v2 as cloudinary } from "cloudinary"
import { getAppBaseUrl } from "@/lib/utils/app-url"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { internalAuthHeaders } from "@/lib/api/internal-auth"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const supabaseServiceRole = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * ENHANCED CLOUDINARY WEBHOOK HANDLER WITH CAPTION URL GENERATION
 *
 * CRITICAL FIX: Properly constructs VTT/SRT URLs from Cloudinary public ID
 * - Generates correct caption file URLs based on audio public ID
 * - Stores both VTT and SRT URLs in database
 * - Ensures Step 5 polling finds hasVtt: true
 */

interface WebhookPayload {
  notification_type: string
  timestamp: string
  request_id: string
  public_id: string
  version: number
  width?: number
  height?: number
  format: string
  resource_type: string
  created_at: string
  tags: string[]
  bytes: number
  type: string
  etag: string
  placeholder: boolean
  url: string
  secure_url: string
  folder: string
  access_mode: string
  context?: {
    custom?: {
      entryId?: string
      type?: string
      processingType?: string
    }
  }
  // Caption-specific fields
  info_kind?: string
  info_status?: string
  info?: {
    google_speech?: {
      status?: string
      transcript?: string
      srt_url?: string
      vtt_url?: string
    }
  }
  // Eager transformation fields — fired when eager_async=true transformation completes
  eager?: Array<{
    transformation: string
    width?: number
    height?: number
    bytes?: number
    format?: string
    url?: string
    secure_url?: string
    status?: string
  }>
  batch_id?: string
}

/**
 * CRITICAL FIX: Parse webhook context to extract entry ID and processing type
 *
 * FIXED LOGIC:
 * - Audio upload (notification_type: "upload") → processingType: "audio_upload"
 * - Caption completion (notification_type: "info" + info_kind: "google_speech") → processingType: "captions"
 * - Video compression (notification_type: "upload" + resource_type: "video") → processingType: "compression"
 */
function parseWebhookContext(payload: WebhookPayload): {
  entryId: string | null
  processingType: string
} {
  console.log("🔍 PARSING WEBHOOK CONTEXT...")
  console.log("  - notification_type:", payload.notification_type)
  console.log("  - resource_type:", payload.resource_type)
  console.log("  - format:", payload.format)
  console.log("  - info_kind:", payload.info_kind)
  console.log("  - info_status:", payload.info_status)
  console.log("  - public_id:", payload.public_id)

  // CRITICAL FIX 1: Caption completion detection (REAL caption completion)
  if (
    payload.notification_type === "info" &&
    payload.info_kind === "google_speech" &&
    payload.info_status === "complete"
  ) {
    console.log("✅ REAL CAPTION COMPLETION DETECTED!")
    console.log("  - This is the actual caption generation completion webhook")

    // Extract entry ID from public_id pattern: pawsense/audio/entry_{entryId}_audio
    const publicIdMatch = payload.public_id.match(/entry_([a-f0-9-]+)_audio/)
    if (publicIdMatch) {
      const entryId = publicIdMatch[1]
      console.log("✅ Entry ID extracted:", entryId)
      return {
        entryId,
        processingType: "captions", // This is actual caption completion
      }
    }
  }

  // CRITICAL FIX 2: Audio upload detection (NOT caption completion)
  if (
    payload.notification_type === "upload" &&
    payload.resource_type === "video" &&
    payload.format === "mp3" &&
    payload.public_id.includes("/audio/")
  ) {
    console.log("🎵 AUDIO UPLOAD DETECTED (NOT CAPTION COMPLETION)!")
    console.log("  - This is just the audio upload, captions will be generated later")

    // Extract entry ID from public_id pattern: pawsense/audio/entry_{entryId}_audio
    const publicIdMatch = payload.public_id.match(/entry_([a-f0-9-]+)_audio/)
    if (publicIdMatch) {
      const entryId = publicIdMatch[1]
      console.log("✅ Entry ID extracted:", entryId)
      return {
        entryId,
        processingType: "audio_upload", // This is just audio upload, not caption completion
      }
    }
  }

  // Eager async transformation completion — fires when eager_async=true job finishes.
  // This is the primary signal for compression completion when videos are large.
  if (
    payload.notification_type === "eager" &&
    payload.resource_type === "video" &&
    !payload.public_id.includes("/audio/")
  ) {
    console.log("🎬 EAGER ASYNC VIDEO TRANSFORMATION COMPLETION DETECTED!")

    // Check custom context first
    if (payload.context?.custom?.entryId) {
      console.log("✅ Entry ID from context:", payload.context.custom.entryId)
      return {
        entryId: payload.context.custom.entryId,
        processingType: "compression",
      }
    }

    // Extract from public_id pattern: pawsense/compressed/entry_{entryId}_compressed
    const publicIdMatch = payload.public_id.match(/entry_([a-f0-9-]+)/)
    if (publicIdMatch) {
      const entryId = publicIdMatch[1]
      console.log("✅ Entry ID extracted from eager webhook:", entryId)
      return {
        entryId,
        processingType: "compression",
      }
    }
  }

  // Video compression completion detection (synchronous upload path)
  if (
    payload.notification_type === "upload" &&
    payload.resource_type === "video" &&
    payload.format !== "mp3" &&
    !payload.public_id.includes("/audio/")
  ) {
    console.log("🎬 VIDEO COMPRESSION COMPLETION DETECTED!")

    // Check custom context first
    if (payload.context?.custom?.entryId) {
      console.log("✅ Entry ID from context:", payload.context.custom.entryId)
      return {
        entryId: payload.context.custom.entryId,
        processingType: "compression",
      }
    }

    // Extract from public_id pattern
    const publicIdMatch = payload.public_id.match(/entry_([a-f0-9-]+)/)
    if (publicIdMatch) {
      const entryId = publicIdMatch[1]
      console.log("✅ Entry ID extracted:", entryId)
      return {
        entryId,
        processingType: "compression",
      }
    }
  }

  console.log("❓ UNKNOWN WEBHOOK TYPE")
  return { entryId: null, processingType: "unknown" }
}

/**
 * CRITICAL FIX: Generate caption URLs from Cloudinary public ID with fallback
 *
 * Cloudinary caption URLs follow this pattern:
 * VTT: https://res.cloudinary.com/{cloud_name}/video/upload/v{version}/{public_id}.vtt
 * SRT: https://res.cloudinary.com/{cloud_name}/video/upload/v{version}/{public_id}.srt
 *
 * Fallback: In some setups captions may be exposed as raw/upload rather than video/upload
 */
function generateCaptionUrls(payload: WebhookPayload): {
  vttUrl: string
  srtUrl: string
  vttUrlFallback: string
  srtUrlFallback: string
} {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const version = payload.version || Date.now() // Use payload version or current timestamp
  const publicId = payload.public_id

  const baseUrl = `https://res.cloudinary.com/${cloudName}/video/upload/v${version}/${publicId}`
  const baseFallbackUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/v${version}/${publicId}`

  const vttUrl = `${baseUrl}.vtt`
  const srtUrl = `${baseUrl}.srt`
  const vttUrlFallback = `${baseFallbackUrl}.vtt`
  const srtUrlFallback = `${baseFallbackUrl}.srt`

  console.log("🔗 GENERATED CAPTION URLS:")
  console.log("  - VTT URL:", vttUrl)
  console.log("  - SRT URL:", srtUrl)
  console.log("  - VTT URL (fallback):", vttUrlFallback)
  console.log("  - SRT URL (fallback):", srtUrlFallback)
  console.log("  - Base public ID:", publicId)
  console.log("  - Version:", version)

  return { vttUrl, srtUrl, vttUrlFallback, srtUrlFallback }
}

/**
 * ENHANCED: Handle caption completion webhook with proper URL generation
 */
async function handleCaptionCompletion(payload: WebhookPayload, entryId: string) {
  console.log("📝 Processing caption completion for entry:", entryId)

  try {
    const { vttUrl, srtUrl, vttUrlFallback, srtUrlFallback } = generateCaptionUrls(payload)

    // Extract transcript from webhook (if available)
    const transcript = payload.info?.google_speech?.transcript || null

    console.log("📝 Caption information processed:")
    console.log("  - Transcript length:", transcript?.length || 0)
    console.log("  - VTT URL generated:", !!vttUrl)
    console.log("  - SRT URL generated:", !!srtUrl)
    console.log("  - VTT URL:", vttUrl)
    console.log("  - SRT URL:", srtUrl)

    // Update database with caption completion and URLs
    const { error: updateError } = await supabaseAdmin
      .from("diary_entries")
      .update({
        caption_status: "completed",
        caption_processing_completed_at: new Date().toISOString(),
        caption_transcript: transcript,
        caption_srt_url: srtUrl, // Store generated SRT URL
        caption_vtt_url: vttUrl, // Store generated VTT URL
        caption_error: null,
      })
      .eq("id", entryId)

    if (updateError) {
      console.error("❌ Failed to update caption status:", updateError)
      return { success: false, error: updateError.message }
    }

    console.log("✅ Caption status updated to completed with URLs:")
    console.log("  - VTT URL stored:", vttUrl)
    console.log("  - SRT URL stored:", srtUrl)
    console.log("  - Transcript stored:", !!transcript)

    // Check if we should trigger merged video creation
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from("diary_entries")
      .select("compression_status, tts_status, voiceover_url, merged_video_status")
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      console.warn("⚠️ Could not fetch entry for auto-trigger check:", fetchError)
      return { success: true, message: "Caption completed but could not check auto-trigger" }
    }

    console.log("🔍 Checking auto-trigger conditions:")
    console.log("  - Compression status:", entry.compression_status)
    console.log("  - TTS status:", entry.tts_status)
    console.log("  - Has voiceover URL:", !!entry.voiceover_url)
    console.log("  - Merged video status:", entry.merged_video_status)

    // Auto-trigger merged video creation if conditions are met
    if (
      entry.compression_status === "completed" &&
      entry.tts_status === "completed" &&
      entry.voiceover_url &&
      (!entry.merged_video_status || entry.merged_video_status === "pending")
    ) {
      console.log("🚀 Auto-triggering merged video creation after caption completion...")

      try {
        const mergedVideoResponse = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
          body: JSON.stringify({ entryId }),
        })

        if (mergedVideoResponse.ok) {
          console.log("✅ Merged video creation triggered successfully")
        } else {
          console.warn("⚠️ Failed to trigger merged video creation:", await mergedVideoResponse.text())
        }
      } catch (triggerError) {
        console.error("❌ Error triggering merged video creation:", triggerError)
      }
    } else {
      console.log("⏸️ Auto-trigger conditions not met, waiting for other processes")
    }

    return {
      success: true,
      message: "Caption completion processed successfully with URLs",
      captionInfo: {
        transcript,
        vttUrl,
        srtUrl,
        vttUrlFallback,
        srtUrlFallback,
      },
    }
  } catch (error) {
    console.error("❌ Error processing caption completion:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * CRITICAL FIX: Handle audio upload webhook (NOT caption completion)
 * This sets caption status to "processing" and waits for the real caption completion webhook
 */
async function handleAudioUpload(payload: WebhookPayload, entryId: string) {
  console.log("🎵 Processing audio upload for entry:", entryId)
  console.log("  - This is NOT caption completion, just audio upload")
  console.log("  - Setting caption status to 'processing' to wait for real completion")

  try {
    // Update database to indicate caption processing has started
    const { error: updateError } = await supabaseAdmin
      .from("diary_entries")
      .update({
        caption_status: "processing", // CRITICAL: Set to processing, NOT completed
        caption_processing_started_at: new Date().toISOString(),
        cloudinary_audio_public_id: payload.public_id,
        caption_error: null,
      })
      .eq("id", entryId)

    if (updateError) {
      console.error("❌ Failed to update audio upload status:", updateError)
      return { success: false, error: updateError.message }
    }

    console.log("✅ Audio upload processed:")
    console.log("  - Caption status set to 'processing'")
    console.log("  - Audio public ID stored:", payload.public_id)
    console.log("  - Waiting for real caption completion webhook...")

    return {
      success: true,
      message: "Audio upload processed, caption generation started",
    }
  } catch (error) {
    console.error("❌ Error processing audio upload:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Handles video compression completion from Cloudinary.
 *
 * NOTE: Credit deduction is handled UPFRONT by the n8n-direct webhook
 * when the video is first uploaded. This webhook only updates the
 * compression status and does NOT deduct credits.
 *
 * Previous implementation called debit_credits_for_entry RPC which
 * caused duplicate charges. Removed as of Oct 27, 2025.
 */
async function handleCompressionCompletion(payload: WebhookPayload, entryId: string) {
  console.log("🗜️ Processing compression completion for entry:", entryId)

  try {
    // For eager_async webhooks the transformed URL lives inside payload.eager[0].secure_url,
    // not at the top-level payload.secure_url. Fall back through all available sources.
    // An eager_async upload's first ("upload") notification lists the eager URL before the
    // 720p copy has been rendered. Marking compression done then started the merge too early and
    // large videos failed with "too large to process synchronously". Wait for the real one.
    if (payload.eager?.length && !readyEagerUrl(payload)) {
      console.log("  - 720p copy still rendering; waiting for the eager notification")
      return { success: true, message: "Compression still rendering" }
    }

    const optimizedUrl =
      payload.eager?.[0]?.secure_url ||
      payload.secure_url ||
      null

    console.log("  - Optimized video URL resolved:", optimizedUrl?.substring(0, 80) + "...")
    console.log("  - URL source:", payload.eager?.[0]?.secure_url ? "eager[0]" : "top-level")

    const { error: updateError } = await supabaseAdmin
      .from("diary_entries")
      .update({
        optimized_video_url: optimizedUrl,
        cloudinary_public_id: payload.public_id,
        compression_status: "completed",
        compression_completed_at: new Date().toISOString(),
        compression_error: null,
      })
      .eq("id", entryId)

    if (updateError) {
      console.error("❌ Failed to update compression status:", updateError)
      return { success: false, error: updateError.message }
    }

    console.log("✅ Compression status updated to completed")

    const { data: entry, error: fetchError } = await supabaseAdmin
      .from("diary_entries")
      .select("video_duration, user_id, tts_status, voiceover_url, merged_video_status")
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      console.error("❌ Failed to fetch entry:", fetchError)
      return { success: false, error: "Entry not found" }
    }

    // Credit deduction handled by n8n-direct webhook for entry
    console.log("ℹ️ Credit deduction handled by n8n-direct webhook for entry:", entryId)

    // Success path - continue with auto-trigger logic
    console.log("🔍 Checking auto-trigger conditions after compression:")
    console.log("  - TTS status:", entry.tts_status)
    console.log("  - Has voiceover URL:", !!entry.voiceover_url)
    console.log("  - Merged video status:", entry.merged_video_status)

    // Check if we should trigger merged video creation
    if (
      ((entry.tts_status === "completed" && entry.voiceover_url) || entry.tts_status === "processing") && // Allow processing TTS since it will trigger later
      // "failed" too: a merge that failed before the 720p copy existed gets one retry now
      (!entry.merged_video_status || entry.merged_video_status === "pending" || entry.merged_video_status === "failed")
    ) {
      if (entry.tts_status === "completed" && entry.voiceover_url) {
        console.log("🚀 Auto-triggering merged video creation after compression completion...")

        try {
          // Add delay for database consistency
          await new Promise((resolve) => setTimeout(resolve, 3000))

          console.log("🚀 Making request to merged video API from compression webhook...")
          const mergedVideoResponse = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
            body: JSON.stringify({ entryId }),
          })

          console.log("📡 Compression webhook merged video API response status:", mergedVideoResponse.status)

          if (mergedVideoResponse.ok) {
            const responseData = await mergedVideoResponse.json()
            console.log("✅ Merged video creation triggered successfully from compression webhook:", responseData)
          } else {
            const errorText = await mergedVideoResponse.text()
            console.error("⚠️ Failed to trigger merged video creation from compression webhook:")
            console.error("  - Status:", mergedVideoResponse.status)
            console.error("  - Error:", errorText)
          }
        } catch (triggerError) {
          console.error("❌ Error triggering merged video creation from compression webhook:", triggerError)
        }
      } else {
        console.log("⏸️ TTS still processing - will let TTS completion handle merged video trigger")
      }
    } else {
      console.log("⏸️ Auto-trigger conditions not met after compression")
      console.log("  - Will retry when TTS completes or conditions change")
    }

    return {
      success: true,
      message: "Compression completion processed successfully",
    }
  } catch (error) {
    console.error("❌ Error processing compression completion:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * ENHANCED DIAGNOSTIC: Cloudinary webhook signature verification
 * Tests all possible signature methods and provides better error messages
 */
async function verifyCloudinarySignature(rawBody: string, req: NextRequest): Promise<boolean> {
  const signature = req.headers.get("X-Cld-Signature")
  const timestamp = req.headers.get("X-Cld-Timestamp")

  if (!signature || !timestamp) {
    console.error("❌ Missing Cloudinary signature headers")
    return false
  }

  const secret = process.env.CLOUDINARY_API_SECRET!

  console.log("🔐 Signature verification:")
  console.log("  - Timestamp:", timestamp)
  console.log("  - Received sig:", signature)
  console.log("  - Body length:", rawBody.length)

  try {
    // Try all possible methods
    const methods = [
      {
        name: "SHA1(body+ts+secret)",
        calc: () =>
          crypto
            .createHash("sha1")
            .update(rawBody + timestamp + secret)
            .digest("hex"),
      },
      {
        name: "HMAC-SHA1(secret, body+ts)",
        calc: () =>
          crypto
            .createHmac("sha1", secret)
            .update(rawBody + timestamp)
            .digest("hex"),
      },
      {
        name: "SDK method",
        calc: () => (cloudinary.utils.verifyNotificationSignature(rawBody, timestamp, signature) ? signature : ""),
      },
    ]

    for (const method of methods) {
      try {
        const result = method.calc()
        if (result === signature) {
          console.log(`✅ Verified using ${method.name}`)
          return true
        }
      } catch (e) {
        // Skip failed methods
      }
    }

    console.error("❌ All signature methods failed")
    console.error("Check: Settings → Webhook Notifications → API Key matches your env var")
    return false
  } catch (error) {
    console.error("❌ Verification error:", error)
    return false
  }
}

/**
 * Main webhook handler with enhanced signature verification and replay protection
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("🔔 =====================================")
  console.log("🔔 CLOUDINARY WEBHOOK RECEIVED")
  console.log("🔔 Timestamp:", new Date().toISOString())
  console.log("🔔 CAPTION URL GENERATION: ENABLED")
  console.log("🔔 =====================================")

  try {
    const rawBody = await request.text()

    const contentType = request.headers.get("content-type") || ""
    console.log("[cld-webhook] ct:", contentType)
    console.log("[cld-webhook] raw[0..100]:", rawBody.slice(0, 100))

    // Verify signature using the raw body
    const isValid = await verifyCloudinarySignature(rawBody, request)
    if (!isValid) {
      console.error("❌ Invalid Cloudinary signature")
      return NextResponse.json({ error: "invalid signature" }, { status: 401 })
    }
    console.log("✅ Cloudinary signature verified")

    const payload: WebhookPayload = contentType.includes("application/x-www-form-urlencoded")
      ? (Object.fromEntries(new URLSearchParams(rawBody)) as any)
      : JSON.parse(rawBody)

    console.log("📦 Webhook payload received:")
    console.log("  - Notification type:", payload.notification_type)
    console.log("  - Public ID:", payload.public_id)
    console.log("  - Resource type:", payload.resource_type)
    console.log("  - Format:", payload.format)
    console.log("  - Version:", payload.version)
    console.log("  - Secure URL:", payload.secure_url?.substring(0, 100) + "...")

    // CRITICAL FIX 1: Enhanced context parsing with caption detection
    const { entryId, processingType } = parseWebhookContext(payload)

    if (!entryId) {
      console.log("⚠️ No entry ID found, ignoring webhook")
      return NextResponse.json({ message: "No entry ID found, webhook ignored" })
    }

    console.log("🎯 Processing webhook:")
    console.log("  - Entry ID:", entryId)
    console.log("  - Processing type:", processingType)

    // CRITICAL FIX: Route to appropriate handler based on processing type
    let result

    if (processingType === "captions") {
      // REAL caption completion webhook with URL generation
      result = await handleCaptionCompletion(payload, entryId)
    } else if (processingType === "audio_upload") {
      // Audio upload webhook (NOT caption completion)
      result = await handleAudioUpload(payload, entryId)
    } else if (processingType === "compression") {
      // Video compression completion webhook
      result = await handleCompressionCompletion(payload, entryId)
    } else {
      console.log("❓ Unknown processing type, ignoring webhook")
      return NextResponse.json({ message: "Unknown processing type, webhook ignored" })
    }

    const processingTime = Date.now() - startTime

    if (result.success) {
      console.log("✅ =====================================")
      console.log("✅ WEBHOOK PROCESSED SUCCESSFULLY")
      console.log("✅ Entry ID:", entryId)
      console.log("✅ Processing type:", processingType)
      console.log("✅ Processing time:", `${processingTime}ms`)
      console.log("✅ Message:", result.message)
      console.log("✅ =====================================")

      return NextResponse.json({
        success: true,
        entryId,
        processingType,
        message: result.message,
        processingTime: `${processingTime}ms`,
      })
    } else {
      console.error("❌ =====================================")
      console.error("❌ WEBHOOK PROCESSING FAILED")
      console.error("❌ Entry ID:", entryId)
      console.error("❌ Processing type:", processingType)
      console.error("❌ Error:", result.error)
      console.error("❌ Processing time:", `${processingTime}ms`)
      console.error("❌ =====================================")

      return NextResponse.json(
        {
          success: false,
          entryId,
          processingType,
          error: result.error,
          processingTime: `${processingTime}ms`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("💥 =====================================")
    console.error("💥 WEBHOOK HANDLER ERROR")
    console.error("💥 Error:", error)
    console.error("💥 Processing time:", `${processingTime}ms`)
    console.error("💥 =====================================")

    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTime: `${processingTime}ms`,
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint for webhook status
 */
export async function GET() {
  return NextResponse.json({
    status: "CLOUDINARY WEBHOOK HANDLER WITH CAPTION URL GENERATION",
    version: "webhook_caption_urls_v1",
    timestamp: new Date().toISOString(),
    critical_fix: {
      issue: "Caption completion webhook wasn't storing VTT/SRT URLs",
      solution: "Generate caption URLs from Cloudinary public ID and version",
      url_pattern: {
        vtt: "https://res.cloudinary.com/{cloud_name}/video/upload/v{version}/{public_id}.vtt",
        srt: "https://res.cloudinary.com/{cloud_name}/video/upload/v{version}/{public_id}.srt",
      },
      example: {
        public_id: "pawsense/audio/entry_62f9fca9-f58a-43b6-a185-3eeb2ae1a5e0_audio",
        version: "1753871425",
        vtt_url:
          "https://res.cloudinary.com/dmp6ovpel/video/upload/v1753871425/pawsense/audio/entry_62f9fca9-f58a-43b6-a185-3eeb2ae1a5e0_audio.vtt",
        srt_url:
          "https://res.cloudinary.com/dmp6ovpel/video/upload/v1753871425/pawsense/audio/entry_62f9fca9-f58a-43b6-a185-3eeb2ae1a5e0_audio.srt",
      },
    },
    supported_webhooks: [
      {
        type: "audio_upload",
        pattern: "notification_type: upload + format: mp3 + /audio/ folder",
        action: "Set caption_status to 'processing', store audio public_id",
        auto_trigger: "None - waits for caption completion",
      },
      {
        type: "caption_completion",
        pattern: "notification_type: info + info_kind: google_speech + info_status: complete",
        action: "Set caption_status to 'completed', generate and store VTT/SRT URLs",
        auto_trigger: "Merged video creation if compression and TTS are also completed",
        url_generation: "Constructs URLs from public_id and version",
      },
      {
        type: "compression_completion",
        pattern: "notification_type: upload + resource_type: video + NOT mp3",
        action: "Set compression_status to 'completed', store optimized video URL",
        auto_trigger: "Merged video creation if TTS is also completed",
      },
    ],
    webhook_flow: [
      "1. Audio uploaded → 'audio_upload' webhook → caption_status: 'processing'",
      "2. Cloudinary generates captions in background (30-40 seconds)",
      "3. Captions ready → 'caption_completion' webhook → Generate VTT/SRT URLs → caption_status: 'completed'",
      "4. Step 5 polling finds hasVtt: true → Includes captions in merged video",
      "5. Auto-trigger merged video if all conditions met",
    ],
  })
}
