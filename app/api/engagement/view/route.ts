import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entryId } = body

    console.log(`📊 Unified view API called for entry: ${entryId}`)

    if (!entryId) {
      return NextResponse.json({ success: false, error: "Missing entryId" }, { status: 400 })
    }

    const ip = request.ip || request.headers.get("x-forwarded-for")?.split(",")[0] || null
    const userAgent = request.headers.get("user-agent") || null

    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("pt_session")
    let sessionId = sessionCookie?.value

    if (!sessionId) {
      console.warn("⚠️ No pt_session cookie found, generating fallback session")
      sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    const supabase = await createClient()

    const { data: tale, error: taleError } = await supabase
      .from("diary_entries")
      .select("id, is_public, user_id")
      .eq("id", entryId)
      .single()

    if (taleError || !tale) {
      console.error("❌ Tale not found:", taleError)
      return NextResponse.json({ success: false, error: "Tale not found" }, { status: 404 })
    }

    if (!tale.is_public) {
      const authSupabase = createServerClient<Database>(
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

      const {
        data: { user },
        error: userError,
      } = await authSupabase.auth.getUser()

      if (userError || !user) {
        console.log("🔒 Private tale access denied: not authenticated")
        return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
      }

      if (tale.user_id !== user.id) {
        console.log("🔒 Private tale access denied: not owner")
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
      }

      sessionId = `${sessionId}_auth_${user.id}`
    }

    console.log(`👁️ Recording view via RPC for ${tale.is_public ? "public" : "private"} tale ${entryId}`)
    console.log(`📊 Session: ${sessionId}, IP: ${ip}, UA: ${userAgent?.substring(0, 50)}...`)

    const { data: currentEntry, error: currentError } = await supabase
      .from("diary_entries")
      .select("view_count")
      .eq("id", entryId)
      .single()

    const previousViewCount = currentEntry?.view_count || 0

    const { data: viewCount, error: rpcError } = await supabase.rpc("record_view", {
      entry_id: entryId,
      session_id: sessionId,
      ip: ip,
      ua: userAgent,
    })

    if (rpcError) {
      console.error(`❌ RPC error recording view:`, rpcError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record view",
        },
        { status: 500 },
      )
    }

    const alreadyViewed = viewCount === previousViewCount

    console.log(`✅ View recorded via unified API, new count: ${viewCount}, already viewed: ${alreadyViewed}`)

    const response = NextResponse.json({
      success: true,
      viewCount: viewCount,
      alreadyViewed: alreadyViewed,
    })

    if (!sessionCookie?.value) {
      response.cookies.set("pt_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60, // 1 year
      })
    }

    return response
  } catch (error) {
    console.error("❌ Unified view API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
