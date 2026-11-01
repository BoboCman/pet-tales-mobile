import { v2 as cloudinary } from "cloudinary"
import { getAppBaseUrl } from "@/lib/utils/app-url"

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

// Compression presets for different use cases
export const COMPRESSION_PRESETS = {
  mobile: {
    width: 720,
    height: 1280,
    crop: "limit",
    quality: "auto:good",
    video_codec: "h264",
    format: "mp4",
  },
  desktop: {
    width: 1080,
    height: 1920,
    crop: "limit",
    quality: "auto:best",
    video_codec: "h264",
    format: "mp4",
  },
  thumbnail: {
    width: 360,
    height: 640,
    crop: "limit",
    quality: "auto:low",
    video_codec: "h264",
    format: "mp4",
  },
}

// ============================================================================
// COMPRESSION FUNCTIONS (Keep these - used for initial video compression)
// ============================================================================

export async function compressVideo(
  videoUrl: string,
  entryId: string,
  preset: keyof typeof COMPRESSION_PRESETS = "mobile",
) {
  try {
    const uploadResult = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      folder: "pawsense/compressed",
      public_id: `entry_${entryId}_${preset}`,
      transformation: [COMPRESSION_PRESETS[preset]],
    })

    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      bytes: uploadResult.bytes,
      duration: uploadResult.duration,
    }
  } catch (error) {
    console.error("Cloudinary compression error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function startAsyncCompression(
  videoUrl: string,
  entryId: string,
  preset: keyof typeof COMPRESSION_PRESETS = "mobile",
) {
  try {
    const webhookUrl = `${getAppBaseUrl()}/api/cloudinary/webhook`
    console.log("Cloudinary notification_url:", webhookUrl)

    const uploadResult = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      folder: "pawsense/compressed",
      public_id: `entry_${entryId}_compressed_v5`,
      eager_async: true,
      eager: [COMPRESSION_PRESETS[preset]],
      notification_url: webhookUrl,
      context: {
        custom: {
          entryId: entryId,
        },
      },
    })

    console.log("✅ Cloudinary upload initiated:", {
      public_id: uploadResult.public_id,
      eager_status: uploadResult.eager?.[0]?.status || "none",
    })

    return {
      success: true,
      publicId: uploadResult.public_id,
      status: "processing",
      message: "Async compression started",
    }
  } catch (error) {
    console.error("Async compression start error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function checkCompressionStatus(publicId: string) {
  try {
    const resource = await cloudinary.api.resource(publicId, {
      resource_type: "video",
    })

    const hasEager = resource.eager && resource.eager.length > 0
    const eagerComplete = hasEager && resource.eager.every((t: any) => t.status === "complete")

    return {
      success: true,
      status: eagerComplete ? "completed" : "processing",
      resource,
      eagerTransformations: resource.eager || [],
      compressedUrl: eagerComplete ? resource.eager[0].secure_url : null,
    }
  } catch (error) {
    console.error("Status check error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export function getCompressedVideoUrl(publicId: string, preset: keyof typeof COMPRESSION_PRESETS = "mobile") {
  return cloudinary.url(publicId, {
    resource_type: "video",
    ...COMPRESSION_PRESETS[preset],
  })
}

// ============================================================================
// AUDIO UPLOAD FUNCTION (Used by simplified API)
// ============================================================================

/**
 * Upload audio from Supabase URL to Cloudinary for use in video merging
 * This is used by the simplified API for URL generation
 */
export async function uploadAudioToCloudinary(supabaseAudioUrl: string, entryId: string) {
  console.log("🎵 =================================")
  console.log("🎵 STARTING AUDIO UPLOAD TO CLOUDINARY")
  console.log("🎵 =================================")

  try {
    console.log("🔗 Audio URL:", supabaseAudioUrl)
    console.log("🆔 Entry ID:", entryId)
    console.log("☁️ Cloudinary config check:")
    console.log("  - Cloud name:", process.env.CLOUDINARY_CLOUD_NAME)
    console.log("  - API key exists:", !!process.env.CLOUDINARY_API_KEY)
    console.log("  - API secret exists:", !!process.env.CLOUDINARY_API_SECRET)

    const uploadOptions = {
      resource_type: "video" as const, // Audio files use "video" resource type in Cloudinary
      folder: "pawsense/audio",
      public_id: `entry_${entryId}_audio_v10`,
      format: "mp3",
    }

    console.log("📤 Upload options:", JSON.stringify(uploadOptions, null, 2))
    console.log("🚀 Starting Cloudinary upload...")

    const uploadResult = await cloudinary.uploader.upload(supabaseAudioUrl, uploadOptions)

    console.log("✅ Audio upload completed successfully!")
    console.log("📊 Upload result:")
    console.log("  - Public ID:", uploadResult.public_id)
    console.log("  - Secure URL:", uploadResult.secure_url)
    console.log("  - Duration:", uploadResult.duration, "seconds")
    console.log("  - File size:", uploadResult.bytes, "bytes")
    console.log("  - Format:", uploadResult.format)
    console.log("  - Resource type:", uploadResult.resource_type)

    return {
      success: true,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      bytes: uploadResult.bytes,
      duration: uploadResult.duration,
    }
  } catch (error) {
    console.error("❌ =================================")
    console.error("❌ AUDIO UPLOAD FAILED")
    console.error("❌ =================================")
    console.error("❌ Error:", error)
    console.error("❌ Error message:", error instanceof Error ? error.message : "Unknown error")
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("❌ Audio URL:", supabaseAudioUrl)
    console.error("❌ Entry ID:", entryId)

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown audio upload error",
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS (Keep these for webhook cleanup)
// ============================================================================

/**
 * Clean up temporary audio files after successful merge (optional)
 * Used by webhook for cleanup
 */
export async function cleanupAudioFile(audioPublicId: string) {
  try {
    console.log("🧹 Cleaning up audio file:", audioPublicId)
    await cloudinary.uploader.destroy(audioPublicId, {
      resource_type: "video",
    })
    console.log("✅ Audio file cleaned up successfully")
    return { success: true }
  } catch (error) {
    console.error("⚠️ Audio cleanup failed (non-critical):", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get direct download URL for merged video
 * Utility function for generating download links
 */
export function getMergedVideoDownloadUrl(publicId: string, filename?: string) {
  return cloudinary.url(publicId, {
    resource_type: "video",
    format: "mp4",
    flags: "attachment",
    public_id: filename ? `${publicId}.${filename}` : publicId,
  })
}

// ============================================================================
// STUB FUNCTION (For build compatibility)
// ============================================================================

/**
 * @deprecated This function has been replaced by the simplified URL generation approach.
 * Use the /api/cloudinary/merged-video endpoint instead.
 */
export function createMergedVideoWithLooping() {
  throw new Error(
    "createMergedVideoWithLooping is deprecated. Use the simplified /api/cloudinary/merged-video endpoint instead.",
  )
}

// ============================================================================
// REMOVED FUNCTIONS (No longer needed with simplified API)
// ============================================================================

// ❌ REMOVED: createStoredMergedVideo (had complex transformation URLs)
// ❌ REMOVED: createMergedVideoTwoStep (not needed with direct API approach)
// ❌ REMOVED: createMergedVideo (not needed with URL generation)
// ❌ REMOVED: checkMergedVideoStatus (not needed with instant completion)
// ❌ REMOVED: getMergedVideoUrl (not needed with direct URL generation)
// ❌ REMOVED: extractPublicIdFromUrl (moved to simplified API)

export default cloudinary
