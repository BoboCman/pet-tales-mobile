"use server"

import { createClient } from "@/lib/supabase/server"
import { checkUploadLimit } from "@/lib/rate-limit/uploads"

export interface RateLimitCheckResult {
  success: boolean
  message: string
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Pre-check before the browser uploads a clip, so a person over the hourly limit
 * finds out before waiting on the upload. /api/video/upload checks again.
 */
export async function checkUploadRateLimit(): Promise<RateLimitCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not signed in: the upload API rejects it anyway
  if (!user) {
    return { success: true, message: "No user", limit: 0, remaining: 0, resetTime: Date.now() }
  }

  const result = await checkUploadLimit(supabase, user.id)
  if (!result.success) {
    const minutes = Math.max(1, Math.ceil((result.retryAfter || 0) / 60))
    return {
      ...result,
      message: `You can start ${result.limit} tales an hour. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    }
  }
  return { ...result, message: "Rate limit check passed" }
}
