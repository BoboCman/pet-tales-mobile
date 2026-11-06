import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Database } from "@/lib/supabase/database.types"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  const type = requestUrl.searchParams.get("type") // recovery, signup, email_change
  let redirectTo = requestUrl.searchParams.get("redirectTo")

  if (error) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("error", error)
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (!redirectTo || !redirectTo.startsWith("/")) {
    redirectTo = "/dashboard/reels/new"
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
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

    try {
      await supabase.auth.exchangeCodeForSession(code)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user?.user_metadata?.terms_accepted_at) {
          await supabase
            .from("users")
            .update({
              terms_accepted_at: user.user_metadata.terms_accepted_at,
              terms_version: user.user_metadata.terms_version,
              privacy_version: user.user_metadata.privacy_version,
            })
            .eq("id", user.id)
        }
      } catch (syncError) {
        // Log the error but don't block authentication flow
        console.error("Consent sync error:", syncError)
      }
    } catch (exchangeError) {
      console.error("Code exchange error:", exchangeError)
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("error", "exchange_failed")
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
