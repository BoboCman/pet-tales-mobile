import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Upload limit: at most MAX_TALES_PER_HOUR new tales per person in a rolling hour.
 *
 * Counts the person's tale deductions in credit_transactions (one row per tale started), so it
 * needs no extra service and holds across serverless instances. Tales already cost credits;
 * this only stops a stuck client or script from firing many uploads in a row.
 * Fails open: if the count can't be read, the upload goes ahead.
 */
export const MAX_TALES_PER_HOUR = 10
const WINDOW_MS = 60 * 60 * 1000

export interface UploadLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number // ms epoch when the oldest counted tale leaves the window
  retryAfter?: number // seconds until allowed again (on deny)
}

export async function checkUploadLimit(supabase: SupabaseClient, userId: string): Promise<UploadLimitResult> {
  const now = Date.now()
  const since = new Date(now - WINDOW_MS).toISOString()
  try {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("transaction_type", "deduction")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(MAX_TALES_PER_HOUR)
    if (error) throw error

    const count = data?.length ?? 0
    const oldest = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : null
    const resetTime = oldest ? oldest + WINDOW_MS : now + WINDOW_MS

    if (count >= MAX_TALES_PER_HOUR) {
      const retryMs = Math.max(1000, resetTime - now)
      return { success: false, limit: MAX_TALES_PER_HOUR, remaining: 0, resetTime, retryAfter: Math.ceil(retryMs / 1000) }
    }
    return { success: true, limit: MAX_TALES_PER_HOUR, remaining: MAX_TALES_PER_HOUR - count, resetTime }
  } catch (error) {
    console.warn("[upload-limit] check failed, allowing upload:", error)
    return { success: true, limit: MAX_TALES_PER_HOUR, remaining: MAX_TALES_PER_HOUR, resetTime: now + WINDOW_MS }
  }
}
