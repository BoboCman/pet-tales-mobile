/**
 * What a tale cost in Cloudinary credits, worked out from its merge log (diary_entries.merge_details).
 *
 * Cloudinary counts video by the second of output (https://cloudinary.com/documentation/transformation_counts):
 * up to 921,600 pixels (1280x720, so our 720x1280) is SD at 2 transformations a second, i.e. 500 seconds
 * per credit; HD is 4 a second. Eager and incoming transformations count the same as on-the-fly ones,
 * and each upload counts as 1. Every pass we run is 720x1280:
 * - compressing the upload to 720p: the whole clip (merge_details.upload_clip_seconds)
 * - each render of the tale: its length (merge_details.renders[].seconds)
 * - a Redo or retry renders again (merge_details.previous_runs keeps the last 4)
 * Storage is close to zero because the finished file is moved to Supabase. The one download of the
 * finished file is counted as bandwidth. Narration audio (0.1 a second) and the few uploads are
 * left out; together they are well under 0.01 credit.
 *
 * This is the cost of making the tale, not the whole account: compare the 7-day total with the
 * Cloudinary dashboard to see anything else using credits.
 */

export const SD_SECONDS_PER_CREDIT = 500
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
  const finalBytes = num(details.renders?.[details.renders.length - 1]?.bytes) ?? 0
  const credits = videoSeconds / SD_SECONDS_PER_CREDIT + finalBytes / BYTES_PER_GB

  return {
    credits,
    dollars: credits * DOLLARS_PER_CREDIT,
    videoSeconds,
    compressSeconds,
    renderSeconds,
    renders,
    runs: runs.length,
    complete,
  }
}

export const formatCredits = (c: number) => (c < 0.01 ? "<0.01" : c.toFixed(2))
export const formatDollars = (d: number) => `$${d.toFixed(2)}`
