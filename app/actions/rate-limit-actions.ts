"use server"

import { createClient } from "@/lib/supabase/server"
import { checkVideoUploadRateLimit } from "@/lib/redis/rate-limiter"
import { getClientIP } from "@/lib/utils/ip-address"

export interface RateLimitCheckResult {
  success: boolean
  message: string
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Server action to check video upload rate limits
 * Called before any storage operations in the upload flow
 */
export async function checkUploadRateLimit(): Promise<RateLimitCheckResult> {
  try {
    console.log("[v0] Starting upload rate limit check", {
      event: "rate_limit_check_start",
    })

    // Get current user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Get client IP address
    const ipAddress = await getClientIP()

    console.log("[v0] Rate limit check context", {
      event: "rate_limit_context",
      hasUser: !!user,
      userId: user?.id,
      ipAddress,
    })

    // Check rate limit
    const rateLimitResult = await checkVideoUploadRateLimit(user?.id || null, ipAddress)

    if (!rateLimitResult.success) {
      console.log("[v0] Rate limit check failed", {
        event: "rate_limit_denied",
        userId: user?.id,
        ipAddress,
        remaining: rateLimitResult.remaining,
        retryAfter: rateLimitResult.retryAfter,
      })

      return {
        success: false,
        message: `Upload limit reached. You can upload ${rateLimitResult.limit} videos per hour. Try again in ${Math.ceil((rateLimitResult.retryAfter || 0) / 60)} minutes.`,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
        retryAfter: rateLimitResult.retryAfter,
      }
    }

    console.log("[v0] Rate limit check passed", {
      event: "rate_limit_allowed",
      userId: user?.id,
      ipAddress,
      remaining: rateLimitResult.remaining,
    })

    return {
      success: true,
      message: "Rate limit check passed",
      limit: rateLimitResult.limit,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
    }
  } catch (error) {
    console.error("[v0] Rate limit check error:", error)

    // Fail open - allow upload if rate limiting fails
    return {
      success: true,
      message: "Rate limit check completed (failsafe)",
      limit: 3,
      remaining: 2,
      resetTime: Date.now() + 60 * 60 * 1000,
    }
  }
}
