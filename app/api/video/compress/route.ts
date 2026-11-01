import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { getAppBaseUrl } from "@/lib/utils/app-url"

// Cloudinary fetches the source video during upload, which can take a while for large files.
export const maxDuration = 300

// Cloudinary refuses to process large videos synchronously, and the source has to be
// pulled over the network by Cloudinary, so cap what we are willing to hand it.
const MAX_VIDEO_BYTES = 75 * 1024 * 1024

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

type CloudinaryError = { message?: string; name?: string; http_code?: number }

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let entryId: string | undefined

  console.log("COMPRESS HANDLER v5 — eager_async (webhook completes the job)")

  try {
    const body = await request.json()
    entryId = body.entryId
    const videoUrl = body.videoUrl

    console.log("Compression request:", { entryId, videoUrl: videoUrl?.substring(0, 100) + "..." })

    if (!entryId || !videoUrl) {
      return NextResponse.json({ error: "Missing entryId or videoUrl" }, { status: 400 })
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.log("Cloudinary configuration incomplete")
      return NextResponse.json({ error: "Cloudinary configuration incomplete" }, { status: 500 })
    }

    // Admin client bypasses RLS
    const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    let contentLength: number | null = null
    try {
      const headResponse = await fetch(videoUrl, { method: "HEAD" })
      const contentLengthHeader = headResponse.headers.get("content-length")
      contentLength = contentLengthHeader ? Number(contentLengthHeader) : null

      console.log("Video URL check:", {
        status: headResponse.status,
        contentType: headResponse.headers.get("content-type"),
        contentLength,
        accessible: headResponse.ok,
      })

      if (!headResponse.ok) {
        return NextResponse.json({ error: `Video URL not accessible: ${headResponse.status}` }, { status: 400 })
      }
    } catch (urlError) {
      console.log("Video URL test failed:", urlError)
      return NextResponse.json({ error: "Video URL not accessible" }, { status: 400 })
    }

    if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_VIDEO_BYTES) {
      const sizeMb = (contentLength / (1024 * 1024)).toFixed(1)
      const message = `Video is ${sizeMb}MB, which exceeds the ${MAX_VIDEO_BYTES / (1024 * 1024)}MB limit`
      console.log("Rejecting oversized video:", message)

      await supabase
        .from("diary_entries")
        .update({ compression_status: "failed", compression_error: message })
        .eq("id", entryId)

      return NextResponse.json(
        { error: "Video too large", details: message, maxBytes: MAX_VIDEO_BYTES, contentLength },
        { status: 413 },
      )
    }

    const { error: updateError } = await supabase
      .from("diary_entries")
      .update({ compression_status: "processing" })
      .eq("id", entryId)

    if (updateError) {
      console.log("Database update failed:", updateError)
      return NextResponse.json({ error: "Database update failed" }, { status: 500 })
    }

    const baseUrl = getAppBaseUrl("https://www.pettaleai.com")
    const webhookUrl = `${baseUrl}/api/video/compress/webhook`
    console.log("Cloudinary notification_url:", webhookUrl)

    if (!webhookUrl.startsWith("https://")) {
      console.log("Invalid webhook URL - must be HTTPS:", webhookUrl)
      return NextResponse.json(
        {
          error: "Invalid webhook URL configuration",
          details: "Webhook URL must be a valid HTTPS URL",
          webhookUrl,
        },
        { status: 500 },
      )
    }

    const uploadOptions = {
      resource_type: "video" as const,
      folder: "pawsense/compressed",
      public_id: `entry_${entryId}_compressed`,
      eager: [
        {
          width: 720,
          crop: "scale",
          video_codec: "h264",
          audio_codec: "aac",
          format: "mp4",
        },
      ],
      eager_async: true,
      notification_url: webhookUrl,
      context: `entryId=${entryId}`,
      timeout: 300000,
    }

    console.log("Starting Cloudinary upload with eager_async:", JSON.stringify(uploadOptions))

    let uploadResult
    try {
      uploadResult = await cloudinary.uploader.upload(videoUrl, uploadOptions)
    } catch (cloudinaryError) {
      const err = cloudinaryError as CloudinaryError
      console.log("Cloudinary upload failed:", err)

      await supabase
        .from("diary_entries")
        .update({
          compression_status: "failed",
          compression_error: err?.message || "Unknown Cloudinary error",
        })
        .eq("id", entryId)

      return NextResponse.json(
        {
          error: "Cloudinary upload failed",
          details: err?.message || "Unknown Cloudinary error",
          cloudinaryError: {
            message: err?.message,
            name: err?.name,
            http_code: err?.http_code,
          },
        },
        { status: 500 },
      )
    }

    console.log("Cloudinary upload accepted:", {
      public_id: uploadResult.public_id,
      bytes: uploadResult.bytes,
      eager: uploadResult.eager?.length || 0,
    })

    // optimized_video_url stays empty until the webhook reports the eager transformation as done,
    // so the entry keeps using the original Supabase video in the meantime.
    const { error: storeError } = await supabase
      .from("diary_entries")
      .update({
        cloudinary_public_id: uploadResult.public_id,
        compression_status: "processing",
        compression_started_at: new Date().toISOString(),
        compression_error: null,
      })
      .eq("id", entryId)

    if (storeError) {
      console.error("Failed to store Cloudinary public_id:", storeError)
    }

    return NextResponse.json({
      success: true,
      entryId,
      status: "processing",
      message: "Compression started; the webhook will save the compressed video URL when it is ready",
      cloudinaryPublicId: uploadResult.public_id,
      webhookUrl,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    console.log("Compression request failed:", error)

    try {
      if (entryId) {
        const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
        await supabase
          .from("diary_entries")
          .update({
            compression_status: "failed",
            compression_error: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", entryId)
      }
    } catch (updateError) {
      console.log("Failed to update error status:", updateError)
    }

    return NextResponse.json(
      {
        error: "Video compression failed",
        details: error instanceof Error ? error.message : "Unknown error",
        debug: { totalDuration: Date.now() - startTime, entryId },
      },
      { status: 500 },
    )
  }
}
