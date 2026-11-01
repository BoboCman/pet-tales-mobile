import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { withRateLimit } from "@/lib/api/auth-middleware"
import { adminRateLimiter } from "@/lib/api/rate-limits"
import { logAdminAction, logApiRequest } from "@/lib/api/audit-logger"
import { withSecurityHeaders } from "@/lib/api/security-headers"
import type { AdminContext } from "@/lib/api/types"

const handler = requireAdmin(async (request: Request, context: AdminContext) => {
  const startTime = Date.now()

  try {
    // Parse request body
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Search for user
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, free_credits, purchased_credits")
      .eq("email", email)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Log admin action
    await logAdminAction(context.userId, "user_search", {
      searchEmail: email,
      foundUserId: user.id,
    })

    // Log API request
    const duration = Date.now() - startTime
    await logApiRequest({
      userId: context.userId,
      endpoint: "/api/admin/credits/search",
      method: "POST",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      statusCode: 200,
      duration,
    })

    const response = NextResponse.json({ user })
    return withSecurityHeaders(response)
  } catch (error) {
    const duration = Date.now() - startTime
    await logApiRequest({
      userId: context.userId,
      endpoint: "/api/admin/credits/search",
      method: "POST",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      statusCode: 500,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    console.error("Search user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withRateLimit(adminRateLimiter, handler)
