/**
 * Did a tale finish the way it should? Read from the merge log (diary_entries.merge_details),
 * so the admin can spot tales that ended early, ran long, failed or got stuck.
 *
 * Same limits the merge uses: the video may run up to 3s past the narration, and may not end
 * more than 1s before it.
 */
export type TaleHealthState = "ok" | "too_short" | "too_long" | "failed" | "stuck" | "processing" | "unknown"

export interface TaleHealth {
  state: TaleHealthState
  label: string
  finalSeconds: number | null
  narrationSeconds: number | null
}

export const TOO_LONG_SLACK_SECONDS = 3
export const TOO_SHORT_SLACK_SECONDS = 1
const STUCK_AFTER_MS = 15 * 60 * 1000

function parseDetails(value: unknown): Record<string, any> | null {
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

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const fmt = (s: number) => `${Math.round(s * 10) / 10}s`

/** True when a finished length matches its narration (used by the merge to record length_ok). */
export function isLengthOk(finalSeconds: number, narrationSeconds: number) {
  return (
    finalSeconds >= narrationSeconds - TOO_SHORT_SLACK_SECONDS &&
    finalSeconds <= narrationSeconds + TOO_LONG_SLACK_SECONDS
  )
}

export function getTaleHealth(entry: {
  merged_video_status?: string | null
  merged_video_error?: string | null
  merged_processing_started_at?: string | null
  merge_details?: unknown
}): TaleHealth {
  const details = parseDetails(entry.merge_details)
  const finalSeconds = num(details?.final_seconds)
  const narrationSeconds = num(details?.audio_seconds)
  const base = { finalSeconds, narrationSeconds }
  const status = entry.merged_video_status

  if (status === "failed") {
    return { ...base, state: "failed", label: entry.merged_video_error ? `Failed: ${entry.merged_video_error}` : "Failed" }
  }
  if (status === "processing" || status === "pending") {
    const started = entry.merged_processing_started_at ? Date.parse(entry.merged_processing_started_at) : NaN
    if (status === "processing" && Number.isFinite(started) && Date.now() - started > STUCK_AFTER_MS) {
      return { ...base, state: "stuck", label: "Stuck in processing for over 15 min" }
    }
    return { ...base, state: "processing", label: "Still being made" }
  }
  if (finalSeconds === null || narrationSeconds === null) {
    return { ...base, state: "unknown", label: "No length log (made before logging started)" }
  }
  if (finalSeconds < narrationSeconds - TOO_SHORT_SLACK_SECONDS) {
    return { ...base, state: "too_short", label: `Ends early: ${fmt(finalSeconds)} video, ${fmt(narrationSeconds)} narration` }
  }
  if (finalSeconds > narrationSeconds + TOO_LONG_SLACK_SECONDS) {
    return { ...base, state: "too_long", label: `Runs long: ${fmt(finalSeconds)} video, ${fmt(narrationSeconds)} narration` }
  }
  return { ...base, state: "ok", label: `Length OK: ${fmt(finalSeconds)} video, ${fmt(narrationSeconds)} narration` }
}

export const NEEDS_ATTENTION: TaleHealthState[] = ["too_short", "too_long", "failed", "stuck"]
