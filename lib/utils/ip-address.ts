import { headers } from "next/headers"

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations (Vercel, Cloudflare, etc.)
 */
export async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers()

    // Check common IP headers in order of preference
    const ipHeaders = [
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip", // Cloudflare
      "x-vercel-forwarded-for", // Vercel
      "x-client-ip",
      "x-cluster-client-ip",
    ]

    for (const header of ipHeaders) {
      const value = headersList.get(header)
      if (value) {
        // x-forwarded-for can contain multiple IPs, take the first one
        const ip = value.split(",")[0].trim()
        if (ip && ip !== "unknown") {
          return ip
        }
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error extracting client IP:", error)
    return null
  }
}
