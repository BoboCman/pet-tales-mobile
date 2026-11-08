import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { sendWelcomeEmail } from "@/lib/email/send"

/**
 * Where Supabase auth email links land (password reset, signup confirmation).
 * The email templates link here with token_hash + type, which works on any device or in-app
 * browser. The default {{ .ConfirmationURL }} flow needs the same browser that asked for the
 * email, so links opened from the Gmail app on a phone used to fail.
 *
 * Template link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const code = url.searchParams.get("code")
  const nextParam = url.searchParams.get("next")
  const fallback = type === "recovery" ? "/auth/reset-password" : "/dashboard/reels/new"
  // Only same-site paths, never "//evil.com"
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : fallback

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

  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) console.error("Email link verify failed:", type, error.message)
    ok = !error
  } else if (code) {
    // Older emails still in inboxes use the PKCE code link
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) console.error("Email link code exchange failed:", error.message)
    ok = !error
  }

  if (!ok) {
    const failUrl =
      type === "recovery" || next === "/auth/reset-password"
        ? new URL("/auth/forgot-password?error=link_expired", request.url)
        : new URL("/auth/login?error=link_expired", request.url)
    return NextResponse.redirect(failUrl)
  }

  if (type === "signup" || type === "email") {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await sendWelcomeEmail(user.id)
    } catch (emailError) {
      console.error("Welcome email error:", emailError)
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
