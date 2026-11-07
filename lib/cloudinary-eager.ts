/**
 * When is the 720p copy really ready?
 *
 * /api/video/compress uploads with eager_async, so Cloudinary sends two notifications:
 *   1. "upload" as soon as the original is stored. Its eager[] entry already carries the final
 *      secure_url, but the file behind it is still being rendered (status "processing").
 *   2. "eager" once the 720p copy has actually been rendered.
 *
 * Treating (1) as "compression done" started the merge minutes too early. The merge then asked
 * Cloudinary for a 720p copy that did not exist yet, Cloudinary tried to render the full original
 * on the fly, and large uploads failed with "Video is too large to process synchronously".
 *
 * Returns the ready URL, or null while the copy is still being rendered.
 */
export function readyEagerUrl(payload: {
  notification_type?: string
  eager?: Array<{ secure_url?: string; status?: string }>
}): string | null {
  const first = payload.eager?.[0]
  if (!first?.secure_url) return null
  if (payload.notification_type === "eager") return first.secure_url
  const status = (first.status || "").toLowerCase()
  // Anything other than an "eager" notification only counts when Cloudinary says it is done
  if (status && status !== "processing" && status !== "pending" && status !== "failed") return first.secure_url
  return null
}
