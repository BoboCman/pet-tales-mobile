/**
 * Phone clips arrive with a messy name and type. A clip saved from Messages, Instagram or
 * AirDrop can be named "IMG_1234.MOV.3gp", have type "video/3gpp", or have no type at all,
 * even though inside it is an ordinary QuickTime/MP4 video. Those clips used to be turned
 * away, or stored under a type the storage bucket refuses.
 *
 * Every phone clip is stored as .mov (video/quicktime) or .mp4 (video/mp4): the two types
 * the pipeline already handles.
 */

const VIDEO_EXTENSIONS = new Set(["mov", "qt", "mp4", "m4v", "3gp", "3g2", "3gpp", "hevc", "heic", "webm", "mkv", "avi"])

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ""
}

/** True for anything that is plausibly a video, even when the browser gives it no type */
export function looksLikeVideo(file: File) {
  if (file.type.startsWith("video/")) return true
  if (VIDEO_EXTENSIONS.has(extensionOf(file.name))) return true
  // Some Android galleries and file apps hand over videos with no type and no extension
  return file.type === "" || file.type === "application/octet-stream"
}

/** Extension and content type to store the clip under */
export function storageTypeFor(file: File): { ext: "mov" | "mp4"; contentType: "video/quicktime" | "video/mp4" } {
  const ext = extensionOf(file.name)
  const isQuickTime = file.type === "video/quicktime" || ext === "mov" || ext === "qt"
  return isQuickTime ? { ext: "mov", contentType: "video/quicktime" } : { ext: "mp4", contentType: "video/mp4" }
}
