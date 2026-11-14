"use client"

import { looksLikeVideo } from "./clip-file"

/**
 * Checks a clip the moment it's picked, so a problem shows up before Create with a tip
 * on what to do, and turns upload errors into plain messages.
 */

export const MAX_CLIP_BYTES = 75 * 1024 * 1024
export const MIN_CLIP_SECONDS = 3
export const MAX_CLIP_SECONDS = 180

export interface ClipInfo {
  durationSeconds: number | null
  width: number | null
  height: number | null
}

export interface ClipProblem {
  reason: "not_video" | "too_large" | "too_short" | "too_long" | "format" | "network" | "out_of_tales" | "limit" | "auth" | "server"
  title: string
  tip: string
}

/** Reads length and size from the clip. Never throws; fields are null when the browser can't read them (e.g. HEVC in desktop Chrome). */
export function readClipInfo(file: File, timeoutMs = 5000): Promise<ClipInfo> {
  return new Promise((resolve) => {
    const empty: ClipInfo = { durationSeconds: null, width: null, height: null }
    if (typeof document === "undefined") return resolve(empty)
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    let done = false
    const finish = (info: ClipInfo) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(url)
      resolve(info)
    }
    const timer = setTimeout(() => finish(empty), timeoutMs)
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () =>
      finish({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      })
    video.onerror = () => finish(empty)
    video.src = url
  })
}

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024))

/** A problem that should stop this clip, or null if it can go ahead */
export function checkClip(file: File, info: ClipInfo): ClipProblem | null {
  if (!looksLikeVideo(file)) {
    return { reason: "not_video", title: "That's not a video", tip: "Pick a video of your pet. Photos and Live Photos don't work yet." }
  }
  if (file.size > MAX_CLIP_BYTES) {
    const is4k = Math.max(info.width ?? 0, info.height ?? 0) >= 2160
    return {
      reason: "too_large",
      title: `This clip is too big (${mb(file.size)} MB, the limit is 75 MB)`,
      tip: is4k
        ? "It's filmed in 4K. Trim it to the best 30 seconds in your Photos app, or film in 1080p (iPhone: Settings > Camera > Record Video)."
        : "Trim it to the best 30 seconds in your Photos app, then pick it again.",
    }
  }
  const secs = info.durationSeconds
  if (secs !== null && secs < MIN_CLIP_SECONDS) {
    return { reason: "too_short", title: "This clip is too short", tip: "Pick one that's at least 3 seconds long. 10 to 60 seconds works best." }
  }
  if (secs !== null && secs > MAX_CLIP_SECONDS) {
    return {
      reason: "too_long",
      title: `This clip is ${Math.round(secs / 60)} minutes long`,
      tip: "Trim it to under 3 minutes in your Photos app. The best tales come from 10 to 60 seconds.",
    }
  }
  return null
}

/** Turns any upload or start error into a plain message */
export function friendlyUploadError(error: unknown, status?: number): ClipProblem {
  const text = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase()
  const code = String((error as { statusCode?: string | number })?.statusCode ?? status ?? "")

  if (code === "415" || text.includes("mime type") || text.includes("invalid_mime")) {
    return { reason: "format", title: "We can't read this video's format", tip: "Open the clip in your Photos app, tap Share > Save Video (or duplicate it), then pick the saved copy." }
  }
  if (code === "413" || text.includes("too large") || text.includes("maximum allowed size") || text.includes("exceeds")) {
    return { reason: "too_large", title: "This clip is too big", tip: "Trim it to the best 30 seconds in your Photos app, then pick it again." }
  }
  if (code === "429" || text.includes("limit reached") || text.includes("too many")) {
    return { reason: "limit", title: "You've started a lot of tales this hour", tip: "Give it a few minutes, then try again." }
  }
  if (code === "402" || text.includes("insufficient") || text.includes("out of")) {
    return { reason: "out_of_tales", title: "You're out of tales", tip: "Pick a plan or a pack to keep creating." }
  }
  if (code === "401" || text.includes("not authenticated") || text.includes("unauthorized") || text.includes("jwt")) {
    return { reason: "auth", title: "You've been signed out", tip: "Sign in again, then pick your clip." }
  }
  if (text.includes("failed to fetch") || text.includes("network") || text.includes("load failed") || text.includes("timeout") || text.includes("aborted")) {
    return { reason: "network", title: "The upload got interrupted", tip: "Check your Wi-Fi or signal and tap Create Tale again." }
  }
  return { reason: "server", title: "Something went wrong on our side", tip: "Please try again in a minute. We've been told about it." }
}

function platformOf(ua: string) {
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone"
  if (/Android/.test(ua)) return "Android"
  if (/Macintosh/.test(ua)) return "Mac"
  if (/Windows/.test(ua)) return "Windows"
  return "other"
}

/** Records a failed clip for Admin > Uploads. Fire and forget; never throws. */
export function reportUploadFailure(args: {
  stage: "picked" | "upload" | "start"
  reason: string
  message?: string
  file?: File | null
  info?: ClipInfo | null
}) {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    const body = JSON.stringify({
      stage: args.stage,
      reason: args.reason,
      message: args.message?.slice(0, 500),
      file_name: args.file?.name?.slice(0, 200),
      file_type: args.file?.type?.slice(0, 100),
      file_size: args.file?.size,
      duration_seconds: args.info?.durationSeconds ?? null,
      width: args.info?.width ?? null,
      height: args.info?.height ?? null,
      user_agent: ua.slice(0, 400),
      platform: platformOf(ua),
    })
    void fetch("/api/uploads/failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body,
    }).catch(() => {})
  } catch {
    // Reporting must never get in the user's way
  }
}
