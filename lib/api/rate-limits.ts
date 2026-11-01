import { RateLimiter } from "./auth-middleware"

/**
 * Get client IP address from request headers
 * Checks x-forwarded-for (Vercel/Cloudflare) first, then x-real-ip
 */
function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim()
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  return "unknown"
}

/**
 * Extract user ID from request
 * Attempts to get from custom header or Authorization token
 */
function extractUserId(request: Request): string | null {
  // Check custom header first
  const userId = request.headers.get("x-user-id")
  if (userId) {
    return userId
  }

  // Could extract from Authorization header if needed
  // For now, return null and fall back to IP
  return null
}

/**
 * Rate limiter for login endpoints
 * 5 requests per 15 minutes per IP
 */
export const loginRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (request) => `login:${getClientIP(request)}`,
})

/**
 * Rate limiter for general API endpoints
 * 100 requests per minute per user (or IP if not authenticated)
 */
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (request) => {
    const userId = extractUserId(request)
    return userId ? `api:user:${userId}` : `api:ip:${getClientIP(request)}`
  },
})

/**
 * Rate limiter for admin endpoints
 * 50 requests per minute per admin
 */
export const adminRateLimiter = new RateLimiter({
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (request) => {
    const userId = extractUserId(request)
    return userId ? `admin:user:${userId}` : `admin:ip:${getClientIP(request)}`
  },
})
