import { Redis } from "@upstash/redis"

// Initialize Redis client using environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number // ms epoch when window fully resets
  retryAfter?: number // seconds until allowed again (on deny)
}

export interface RateLimitConfig {
  limit: number // e.g. 3
  windowMs: number // e.g. 3600000
  keyPrefix: string // e.g. "video_upload"
}

/**
 * Rolling window rate limiter using Redis
 * Implements a sliding window counter approach for accurate rate limiting
 */
export async function checkRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const { limit, windowMs, keyPrefix } = config
  const key = `${keyPrefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - windowMs

  const member = `${now}-${Math.random().toString(36).slice(2)}`

  try {
    // 1) Cleanup + count (pipeline)
    const p1 = redis.pipeline().zremrangebyscore(key, "-inf", windowStart).zcard(key)
    const res1 = await p1.exec()

    const currentCount = Number(res1?.[1]?.result ?? 0)

    // 2) Oldest score (separate call; not in pipeline)
    //    Use rank 0 since we score by timestamp ascending.
    const oldestArr = await redis.zrange<{ member: string; score: number }[]>(key, 0, 0, { withScores: true })
    const oldestScore = Array.isArray(oldestArr) && oldestArr.length ? Number(oldestArr[0].score) : null

    // 3) Decision BEFORE adding new member
    if (currentCount >= limit) {
      const retryMs = Math.max(1000, oldestScore ? oldestScore + windowMs - now : windowMs)
      return {
        success: false,
        limit,
        remaining: 0,
        resetTime: now + retryMs,
        retryAfter: Math.ceil(retryMs / 1000),
      }
    }

    // 4) Allow and record this attempt
    const p2 = redis
      .pipeline()
      .zadd(key, { score: now, member })
      .expire(key, Math.ceil(windowMs / 1000) + 60)
    await p2.exec()

    // Remaining after adding this attempt
    const remaining = Math.max(0, limit - (currentCount + 1))
    const resetTime = oldestScore ? oldestScore + windowMs : now + windowMs

    console.log(`[v0] Rate limit check passed for ${identifier}`, {
      event: "rate_limit_check",
      identifier,
      currentCount,
      limit,
      remaining,
    })

    return { success: true, limit, remaining, resetTime }
  } catch (error) {
    console.error(`[v0] Rate limiter error for ${identifier}:`, error)

    // Fail open - allow request if Redis is down
    console.log(`[v0] Rate limiter failing open due to error`, {
      event: "rate_limit_error",
      identifier,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetTime: now + windowMs,
    }
  }
}

/**
 * Rate limit configuration for video uploads
 * 3 uploads per 60 minutes (3600 seconds)
 */
export const VIDEO_UPLOAD_RATE_LIMIT: RateLimitConfig = {
  limit: 3,
  windowMs: 60 * 60 * 1000, // 60 minutes in milliseconds
  keyPrefix: "video_upload",
}

/**
 * Check rate limit for video uploads
 * Uses user ID if authenticated, falls back to IP address
 */
export async function checkVideoUploadRateLimit(
  userId: string | null,
  ipAddress: string | null,
): Promise<RateLimitResult> {
  // Prefer user-based limiting for authenticated users
  const identifier = userId || ipAddress || "anonymous"

  console.log(`[v0] Checking video upload rate limit`, {
    event: "video_upload_rate_check",
    userId,
    ipAddress,
    identifier,
  })

  return checkRateLimit(identifier, VIDEO_UPLOAD_RATE_LIMIT)
}
