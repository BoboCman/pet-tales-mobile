import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ensureSessionCookie = (res: NextResponse, request: NextRequest) => {
  if (!request.cookies.get("pt_session")) {
    res.cookies.set("pt_session", crypto.randomUUID(), {
      maxAge: 7776000, // 90 days in seconds
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Set to true for better security
    })
  }
  return res
}

export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return response
  }

  const existingSessionCookie = request.cookies.get("pt_session")
  if (!existingSessionCookie) {
    // Generate a UUID for the session
    const sessionId = crypto.randomUUID()

    // Set the cookie with 90 days expiry
    response.cookies.set("pt_session", sessionId, {
      maxAge: 7776000, // 90 days in seconds
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Set to true for better security
    })

    console.log(`🍪 Generated new session cookie: ${sessionId}`)
  }

  // Public paths that don't require authentication
  const publicPaths = ["/", "/community/public", "/auth/login", "/auth/signup", "/auth/callback", "/terms", "/privacy"]

  const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith("/community/public/")

  // Protected routes require authentication
  const isProtectedRoute = pathname.startsWith("/dashboard")

  // Admin route protection
  const isAdminRoute = pathname.startsWith("/admin")
  const isAdminLoginPage = pathname === "/admin/login"

  // Protect admin routes (except login page)
  if (isAdminRoute && !isAdminLoginPage) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        const redirectUrl = new URL("/admin/login", request.url)
        const redirectRes = NextResponse.redirect(redirectUrl)
        ensureSessionCookie(redirectRes, request)
        return redirectRes
      }

      // Check if user is admin
      const { data: userData } = await supabase
        .from("users")
        .select("email, is_admin")
        .eq("id", session.user.id)
        .single()

      if (!userData || !userData.is_admin) {
        const redirectUrl = new URL("/admin/login", request.url)
        const redirectRes = NextResponse.redirect(redirectUrl)
        ensureSessionCookie(redirectRes, request)
        return redirectRes
      }
    } catch (error) {
      console.error("Admin middleware auth check error:", error)
      const redirectUrl = new URL("/admin/login", request.url)
      const redirectRes = NextResponse.redirect(redirectUrl)
      ensureSessionCookie(redirectRes, request)
      return redirectRes
    }
  }

  if (isProtectedRoute && !isPublicPath) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        const redirectUrl = new URL("/auth/login", request.url)
        redirectUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search)
        const redirectRes = NextResponse.redirect(redirectUrl)
        ensureSessionCookie(redirectRes, request)
        return redirectRes
      }
    } catch (error) {
      console.error("Middleware auth check error:", error)
      const redirectUrl = new URL("/auth/login", request.url)
      redirectUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search)
      const redirectRes = NextResponse.redirect(redirectUrl)
      ensureSessionCookie(redirectRes, request)
      return redirectRes
    }
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (pathname.startsWith("/auth/") && pathname !== "/auth/callback") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        const redirectRes = NextResponse.redirect(new URL("/dashboard/pets", request.url))
        ensureSessionCookie(redirectRes, request)
        return redirectRes
      }
    } catch (error) {
      console.error("Middleware auth redirect error:", error)
      // Continue to auth page if there's an error
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
