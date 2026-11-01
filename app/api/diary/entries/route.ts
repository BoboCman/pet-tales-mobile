import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") || "ready"

    let query = supabase
      .from("diary_entries")
      .select(`
        id,
        title,
        content,
        mood,
        video_url,
        optimized_video_url,
        merged_video_url,
        merged_video_supabase_url,
        voiceover_url,
        created_at,
        view_count,
        like_count,
        is_public,
        narration_style,
        narration_genre,
        pets (
          id,
          name,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .eq("user_id", user.id)
      .neq("billing_status", "billing_required")

    if (scope !== "all") {
      query = query
        .eq("compression_status", "completed")
        .eq("tts_status", "completed")
        .eq("caption_status", "completed")
        .eq("merged_video_status", "completed")
        .not("merged_video_url", "is", null)
    }

    const { data: entries, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching diary entries:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch entries" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      entries: entries || [],
    })
  } catch (error) {
    console.error("Error in diary entries API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
