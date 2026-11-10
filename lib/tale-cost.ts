/**
 * What a tale cost in Cloudinary credits, worked out from its merge log (diary_entries.merge_details).
 *
 * Cloudinary bills video processing by the second of output: 1 credit = 250 seconds of HD video
 * (720p counts as HD; SD is 500 seconds per credit). Every pass we run is 720x1280, so:
 * - compressing the upload to 720p: the whole clip (merge_details.upload_clip_seconds)
 * - each render of the tale: its length (merge_details.renders[].seconds)
 * - a Redo or retry renders again (merge_details.previous_runs keeps the last 4)
 * Plain uploads and copies (no transformation) are not processing. Storage is close to zero because
 * the finished file is moved to Supabase. The one download of the finished file counts as bandwidth.
 *
 * This matched the dashboard on 2026-11-10: 5,298 seconds of 720p in a week was ~21.2K of the
 * 22.1K transformations shown.
 */

export const HD_SECONDS_PER_CREDIT = 250
/** Plus plan: $99 a month for 225 credits */
export const DOLLARS_PER_CREDIT = 99 / 225
const BYTES_PER_GB = 1024 ** 3

export interface TaleCost {
  credits: number
  dollars: number
  /** Seconds of 720p video Cloudinary processed for this tale, all runs included */
  videoSeconds: number
  compressSeconds: number | null
  renderSeconds: number
  /** Renders in this run plus earlier runs (Redo, retries) */
  renders: number
  runs: number
  /** False when part of the log is missing (older tales), so the number is a floor */
  complete: boolean
  /** Video sizes as WIDTHxHEIGHT, when logged: the upload, its 720p copy, and the final tale */
  sizes: { upload: string | null; compressed: string | null; final: string | null }
}

function parse(value: unknown): Record<string, any> | null {
  if (!value) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return typeof value === "object" ? (value as Record<string, any>) : null
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null)

/** Null when the tale has no merge log with renders (made before 2026-11-09). */
export function getTaleCost(mergeDetails: unknown): TaleCost | null {
  const details = parse(mergeDetails)
  if (!details) return null

  const runs = [details, ...(Array.isArray(details.previous_runs) ? details.previous_runs : [])].filter(
    (r) => r && Array.isArray(r.renders),
  )
  if (runs.length === 0) return null

  let renderSeconds = 0
  let renders = 0
  let complete = true
  for (const run of runs) {
    for (const r of run.renders) {
      const s = num(r?.seconds)
      renders++
      if (s) renderSeconds += s
      else complete = false
    }
  }

  // The upload is compressed once, whatever happens to the tale afterwards
  const compressSeconds = num(details.upload_clip_seconds)
  if (!compressSeconds) complete = false

  const videoSeconds = renderSeconds + (compressSeconds ?? 0)
  const lastRender = Array.isArray(details.renders) ? details.renders[details.renders.length - 1] : undefined
  const finalBytes = num(lastRender?.bytes) ?? 0
  const credits = videoSeconds / HD_SECONDS_PER_CREDIT + finalBytes / BYTES_PER_GB

  return {
    credits,
    dollars: credits * DOLLARS_PER_CREDIT,
    videoSeconds,
    compressSeconds,
    renderSeconds,
    renders,
    runs: runs.length,
    complete,
    sizes: {
      upload: typeof details.upload_size === "string" ? details.upload_size : null,
      compressed: typeof details.compressed_size === "string" ? details.compressed_size : null,
      final: lastRender?.width && lastRender?.height ? `${lastRender.width}x${lastRender.height}` : null,
    },
  }
}

export const formatCredits = (c: number) => (c < 0.01 ? "<0.01" : c.toFixed(2))
export const formatDollars = (d: number) => `$${d.toFixed(2)}`
