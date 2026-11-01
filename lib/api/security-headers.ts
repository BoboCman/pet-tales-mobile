import type { NextResponse } from "next/server"
import type { SecurityHeaders } from "./types"

/**
 * Get security headers for API responses
 * Implements OWASP security best practices
 */
export function getSecurityHeaders(): SecurityHeaders {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
  }
}

/**
 * Add security headers to a Response object
 * @param response - The response to add headers to
 * @returns Response with security headers added
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders()

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
