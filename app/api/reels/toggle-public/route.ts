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

    // Get current entry to check ownership and current status
    const { data: entry, error: fetchError } = await supabase
      .from("diary_entries")
      .select("id, is_public, user_id")
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 })
    }

    if (entry.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    // Toggle the public status
    const newIsPublic = !entry.is_public

    const { error: updateError } = await supabase
      .from("diary_entries")
      .update({ is_public: newIsPublic })
      .eq("id", entryId)
      .eq("user_id", user.id)

    if (updateError) {
      console.error("Error updating public status:", updateError)
      return NextResponse.json({ success: false, error: "Failed to update public status" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      isPublic: newIsPublic,
    })
  } catch (error) {
    console.error("Error in toggle public API:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
