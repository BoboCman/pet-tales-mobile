import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type {
  AuthContext,
  AdminContext,
  SessionVerificationResult,
  AdminVerificationResult,
  RequestValidationResult,
  RateLimitConfig,
  RateLimitResult,
} from "./types"
import { logFailedAuth, logRateLimitHit } from "./audit-logger"
import { withSecurityHeaders } from "./security-headers"

// Admin cache to reduce database queries
const adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>()
const ADMIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Verify session from request
 * Checks Authorization header first, then falls back to cookies
 */
export async function verifySession(request: Request): Promise<SessionVerificationResult> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )

    // getUser() authenticates by contacting Supabase Auth server, not just reading cookies
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error("[verifySession] Error getting user:", error.message)
      return {
        session: null,
        user: null,
        error: "Failed to verify session",
      }
    }

    if (!user) {
      console.error("[verifySession] No user found in session")
      return {
        session: null,
        user: null,
        error: "No active session",
      }
    }

    // Get session for additional context (but don't rely on it for auth)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    console.log("[verifySession] User authenticated:", {
      userId: user.id,
      email: user.email,
    })

    return {
      session,
      user,
      error: null,
    }
  } catch (error) {
    console.error("[verifySession] Unexpected error:", error)
    return {
      session: null,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Verify user has admin privileges
 * Uses 5-minute cache to reduce database load
 */
export async function verifyAdmin(userId: string): Promise<AdminVerificationResult> {
  try {
    // Check cache first
    const cached = adminCache.get(userId)
    if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL) {
      if (cached.isAdmin) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll()
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
              },
            },
          },
        )
        const { data: user } = await supabase.from("users").select("id, email, is_admin").eq("id", userId).single()

        return {
          isAdmin: true,
          user: user || null,
          error: null,
        }
      }
      return {
        isAdmin: false,
        user: null,
        error: "User is not an admin",
      }
    }

    // Query database
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )
    const { data: user, error } = await supabase.from("users").select("id, email, is_admin").eq("id", userId).single()

    if (error || !user) {
      return {
        isAdmin: false,
        user: null,
        error: "User not found",
      }
    }

    // Update cache
    adminCache.set(userId, {
      isAdmin: user.is_admin || false,
      timestamp: Date.now(),
    })

    if (!user.is_admin) {
      return {
        isAdmin: false,
        user: null,
        error: "User is not an admin",
      }
    }

    return {
      isAdmin: true,
      user,
      error: null,
    }
  } catch (error) {
    return {
      isAdmin: false,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Rate limiter class for in-memory rate limiting
 */
export class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if request is allowed under rate limit
   */
  check(request: Request): RateLimitResult {
    const key = this.config.keyGenerator(request)
    const now = Date.now()

    // Clean up old entries
    this.cleanup(now)

    const record = this.requests.get(key)

    if (!record || now > record.resetTime) {
      // First request or window expired
      const resetTime = now + this.config.windowMs
      this.requests.set(key, { count: 1, resetTime })

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
      }
    }

    if (record.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      }
    }

    // Increment count
    record.count++
    this.requests.set(key, record)

    return {
      allowed: true,
      remaining: this.config.maxRequests - record.count,
      resetTime: record.resetTime,
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key)
      }
    }
  }
}

/**
 * Validate request format and content
 */
export function validateRequest(request: Request): RequestValidationResult {
  const method = request.method

  // Check Content-Type for POST/PUT requests
  if (method === "POST" || method === "PUT") {
    const contentType = request.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      return {
        valid: false,
        error: "Content-Type must be application/json",
      }
    }
  }

  // Check for suspicious patterns in URL
  const url = new URL(request.url)
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i, // Event handlers like onclick=
    /\.\.\//, // Path traversal
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url.search)) {
      return {
        valid: false,
        error: "Suspicious pattern detected in request",
      }
    }
  }

  return {
    valid: true,
    error: null,
  }
}

/**
 * Wrapper for authenticated endpoints
 * Verifies session and passes AuthContext to handler
 */
export function requireAuth(
  handler: (request: Request, context: AuthContext) => Promise<Response>,
): (request: Request, context?: any) => Promise<Response> {
  return async (request: Request, context?: any) => {
    const startTime = Date.now()

    // Validate request
    const validation = validateRequest(request)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Verify session
    const { session, user, error } = await verifySession(request)

    if (error || !session || !user) {
      const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
      await logFailedAuth(ipAddress, error || "No session")

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const authContext: AuthContext = {
      ...context, // Spread original context to include params from Next.js
      session,
      user,
      userId: user.id,
      userEmail: user.email || "",
    }

    try {
      // Call handler
      const response = await handler(request, authContext)
      return withSecurityHeaders(response as NextResponse)
    } catch (error) {
      console.error("[requireAuth] Handler error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}

/**
 * Wrapper for admin-only endpoints
 * Verifies session AND admin status, passes AdminContext to handler
 */
export function requireAdmin(
  handler: (request: Request, context: AdminContext) => Promise<Response>,
): (request: Request, context?: any) => Promise<Response> {
  return async (request: Request, context?: any) => {
    const startTime = Date.now()

    // Validate request
    const validation = validateRequest(request)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Verify session
    const { session, user, error: sessionError } = await verifySession(request)

    if (sessionError || !user) {
      console.error("[requireAdmin] Session verification failed:", sessionError || "No user")
      const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
      await logFailedAuth(ipAddress, sessionError || "No session")

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!user.id) {
      console.error("[requireAdmin] User object missing id property")
      return NextResponse.json({ error: "Invalid user session" }, { status: 401 })
    }

    // Verify admin status
    const { isAdmin, error: adminError } = await verifyAdmin(user.id)

    if (!isAdmin) {
      console.error("[requireAdmin] User is not an admin:", user.email)
      const ipAddress = request.headers.get("x-forwarded-for") || "unknown"
      await logFailedAuth(ipAddress, adminError || "Not an admin")

      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const adminContext: AdminContext = {
      ...context, // Spread original context to include params from Next.js
      session,
      user,
      userId: user.id,
      userEmail: user.email || "",
      isAdmin: true,
      adminEmail: user.email || "",
    }

    console.log("[requireAdmin] Admin authenticated:", {
      userId: user.id,
      email: user.email,
    })

    try {
      // Call handler
      const response = await handler(request, adminContext)
      return withSecurityHeaders(response as NextResponse)
    } catch (error) {
      console.error("[requireAdmin] Handler error:", error)
      console.error("[requireAdmin] Error stack:", error instanceof Error ? error.stack : "No stack trace")
      return NextResponse.json(
        {
          error: "Internal server error",
          details:
            process.env.NODE_ENV === "development" ? (error instanceof Error ? error.message : undefined) : undefined,
        },
        { status: 500 },
      )
    }
  }
}

/**
 * Wrapper for rate-limited endpoints
 * Checks rate limit before calling handler
 */
export function withRateLimit(
  limiter: RateLimiter,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    // Check rate limit
    const result = limiter.check(request)

    if (!result.allowed) {
      // Rate limit exceeded
      const userId = request.headers.get("x-user-id") || "unknown"
      const endpoint = new URL(request.url).pathname
      await logRateLimitHit(userId, endpoint)

      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)

      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": limiter["config"].maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
        },
      )
    }

    // Call handler
    return handler(request)
  }
}
