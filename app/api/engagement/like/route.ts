import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entryId } = body

    if (!entryId) {
      return NextResponse.json({ success: false, error: "Missing entryId" }, { status: 400 })
    }

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

    // Check if user has already liked this entry
    const { data: existingLike, error: likeCheckError } = await supabase
      .from("diary_entry_likes")
      .select("id")
      .eq("diary_entry_id", entryId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (likeCheckError) {
      console.error("Error checking existing like:", likeCheckError)
      return NextResponse.json({ success: false, error: "Failed to check like status" }, { status: 500 })
    }

    const hasLiked = !!existingLike

    if (hasLiked) {
      // Remove like
      const { error: deleteError } = await supabase
        .from("diary_entry_likes")
        .delete()
        .eq("diary_entry_id", entryId)
        .eq("user_id", user.id)

      if (deleteError) {
        console.error("Error removing like:", deleteError)
        return NextResponse.json({ success: false, error: "Failed to remove like" }, { status: 500 })
      }
    } else {
      // Add like
      const { error: insertError } = await supabase.from("diary_entry_likes").insert({
        diary_entry_id: entryId,
        user_id: user.id,
      })

      if (insertError) {
        console.error("Error adding like:", insertError)
        return NextResponse.json({ success: false, error: "Failed to add like" }, { status: 500 })
      }
    }

    // Get updated like count
    const { data: entryData, error: countError } = await supabase
      .from("diary_entries")
      .select("like_count")
      .eq("id", entryId)
      .single()

    if (countError) {
      console.error("Error getting updated like count:", countError)
      return NextResponse.json({ success: false, error: "Failed to get updated like count" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      liked: !hasLiked,
      likeCount: entryData.like_count || 0,
    })
  } catch (error) {
    console.error("Error in like API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
