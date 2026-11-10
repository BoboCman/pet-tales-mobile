import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * How /api/video/compress makes the 720p copy, and how we learn it is ready.
 *
 * The upload uses eager + eager_async, with BOTH notification_url and eager_notification_url.
 * Per https://cloudinary.com/documentation/notifications ("eager + notification_url +
 * eager_notification_url + eager_async"):
 *   1. notification_url gets an "upload" notification once the original is stored.
 *   2. eager_notification_url gets an "eager" notification once the 720p copy is rendered
 *      (or with status "failed" and a reason if rendering failed).
 * Without eager_notification_url, (2) is never sent, which is why tales sat at "processing".
 *
 * Starting the merge on (1) is too early: the 720p copy does not exist yet, so Cloudinary
 * tries to render the full original on the fly and large uploads fail with "Video is too
 * large to process synchronously".
 */
// Fit inside 720x1280 (921,600 pixels). Cloudinary bills video above that as HD, at twice the SD rate
// (https://cloudinary.com/documentation/transformation_counts). A width-only scale let tall phone
// clips (e.g. 1080x2400) come out 720x1600, which is HD. "limit" keeps the shape and never upscales.
export const COMPRESS_EAGER = {
  width: 720,
  height: 1280,
  crop: "limit",
  video_codec: "h264",
  audio_codec: "aac",
  format: "mp4",
} as const

type EagerItem = {
  secure_url?: string
  status?: string
  reason?: string
  transformation?: string
  width?: number
  height?: number
}

/** Returns the ready URL, or null while the copy is still being rendered. */
export function readyEagerUrl(payload: { notification_type?: string; eager?: EagerItem[] }): string | null {
  const first = payload.eager?.[0]
  if (!first?.secure_url) return null
  const status = (first.status || "").toLowerCase()
  if (status === "failed") return null
  if (payload.notification_type === "eager") return first.secure_url
  // Anything other than an "eager" notification only counts when Cloudinary says it is done
  if (status && status !== "processing" && status !== "pending") return first.secure_url
  return null
}

/** The failure reason from an "eager" notification, or null if it did not fail. */
export function eagerFailure(payload: { notification_type?: string; eager?: EagerItem[] }): string | null {
  if (payload.notification_type !== "eager") return null
  const failed = payload.eager?.find((e) => (e.status || "").toLowerCase() === "failed")
  if (!failed) return null
  return failed.reason || "Cloudinary could not make the 720p copy"
}

/**
 * Ask Cloudinary directly whether the 720p copy exists. Used when a notification went missing,
 * so nothing has to wait on a webhook that will never come. The Admin API lists rendered
 * derivatives under `derived`; a 720p copy shows up there as e.g. "ac_aac,c_limit,h_1280,vc_h264,w_720/mp4".
 */
export async function findCompressedCopy(publicId: string): Promise<string | null> {
  const resource: any = await cloudinary.api.resource(publicId, { resource_type: "video" })
  const derived: Array<{ transformation?: string; format?: string; secure_url?: string }> = resource?.derived || []
  const match = derived.find((d) => {
    const t = d.transformation || ""
    // c_limit,h_1280 since Nov 2026; c_scale on older uploads
    return (
      t.includes("w_720") &&
      (t.includes("c_limit") || t.includes("c_scale")) &&
      (d.format === "mp4" || t.endsWith("/mp4"))
    )
  })
  return match?.secure_url || null
}
