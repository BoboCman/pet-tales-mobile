import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isInternalRequest } from "@/lib/api/internal-auth"

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    console.log("📥 N8N Webhook received")

    const body = await request.json()
    console.log("📦 Webhook payload:", JSON.stringify(body, null, 2))

    // Extract data from webhook payload
    const {
      pet_id,
      user_id,
      video_url,
      pet_name,
      pet_type,
      pet_breed,
      pet_gender,
      title = "New Pet Tale",
      content,
      thumbnail_url,
    } = body

    // Validate required fields
    if (!pet_id || !user_id || !video_url) {
      console.error("❌ Missing required fields:", { pet_id, user_id, video_url })
      return NextResponse.json({ error: "Missing required fields: pet_id, user_id, video_url" }, { status: 400 })
    }

    // Create diary entry
    const entryData = {
      pet_id,
      user_id,
      video_url,
      pet_name: pet_name || null,
      pet_type: pet_type || null,
      pet_breed: pet_breed || null,
      pet_gender: pet_gender || null,
      title,
      content: content || null,
      thumbnail_url: thumbnail_url || null,
      entry_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      enhancement_status: "pending",
      compression_status: "not_requested",
      merged_video_status: "not_requested",
    }

    console.log("💾 Creating diary entry:", entryData)

    const { data: entry, error } = await supabaseAdmin.from("diary_entries").insert(entryData).select().single()

    if (error) {
      console.error("❌ Failed to create diary entry:", error)
      return NextResponse.json({ error: "Failed to create diary entry", details: error.message }, { status: 500 })
    }

    console.log("✅ Diary entry created successfully:", entry.id)

    return NextResponse.json({
      success: true,
      entry_id: entry.id,
      message: "Diary entry created successfully",
    })
  } catch (error) {
    console.error("❌ N8N webhook error:", error)
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
