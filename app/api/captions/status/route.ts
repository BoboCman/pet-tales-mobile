import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getAppBaseUrl } from "@/lib/utils/app-url"

/**
 * CAPTION STATUS API
 *
 * Provides detailed status information about caption generation for diary entries
 * Supports both individual entry queries and bulk status checks
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log("📝 =====================================")
  console.log("📝 CAPTION STATUS API REQUEST")
  console.log("📝 Timestamp:", new Date().toISOString())
  console.log("📝 =====================================")

  try {
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get("entryId")
    const includeTranscript = searchParams.get("includeTranscript") === "true"
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    if (entryId) {
      // Single entry status
      console.log("🔍 Fetching caption status for entry:", entryId)

      const selectFields = [
        "id",
        "pet_name",
        "title",
        "caption_status",
        "caption_processing_started_at",
        "caption_processing_completed_at",
        "caption_error",
        "caption_vtt_url",
        "caption_srt_url",
        "cloudinary_audio_public_id",
      ]

      if (includeTranscript) {
        selectFields.push("caption_transcript")
      }

      const { data: entry, error } = await supabaseAdmin
        .from("diary_entries")
        .select(selectFields.join(", "))
        .eq("id", entryId)
        .single()

      if (error || !entry) {
        console.error("❌ Entry not found:", error)
        return NextResponse.json({ error: "Entry not found" }, { status: 404 })
      }

      const processingTime = Date.now() - startTime
      console.log("✅ Caption status retrieved for entry:", entryId)
      console.log("  - Status:", entry.caption_status)
      console.log("  - Has VTT:", !!entry.caption_vtt_url)
      console.log("  - Has SRT:", !!entry.caption_srt_url)
      console.log("  - Processing time:", `${processingTime}ms`)

      return NextResponse.json({
        success: true,
        entry: {
          id: entry.id,
          pet_name: entry.pet_name,
          title: entry.title,
          caption_status: entry.caption_status,
          caption_processing_started_at: entry.caption_processing_started_at,
          caption_processing_completed_at: entry.caption_processing_completed_at,
          caption_error: entry.caption_error,
          caption_files: {
            vtt_url: entry.caption_vtt_url,
            srt_url: entry.caption_srt_url,
          },
          cloudinary_audio_public_id: entry.cloudinary_audio_public_id,
          ...(includeTranscript && { caption_transcript: entry.caption_transcript }),
        },
        processingTime: `${processingTime}ms`,
      })
    } else {
      // Bulk status query
      console.log("📊 Fetching bulk caption status (limit:", limit, ")")

      const { data: entries, error } = await supabaseAdmin
        .from("diary_entries")
        .select(`
          id,
          pet_name,
          title,
          caption_status,
          caption_processing_started_at,
          caption_processing_completed_at,
          caption_error,
          caption_vtt_url,
          caption_srt_url,
          cloudinary_audio_public_id,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("❌ Failed to fetch entries:", error)
        return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 })
      }

      // Calculate statistics
      const stats = {
        total: entries.length,
        completed: entries.filter((e) => e.caption_status === "completed").length,
        processing: entries.filter((e) => e.caption_status === "processing").length,
        failed: entries.filter((e) => e.caption_status === "failed").length,
        pending: entries.filter((e) => !e.caption_status || e.caption_status === "pending").length,
      }

      const processingTime = Date.now() - startTime
      console.log("✅ Bulk caption status retrieved:")
      console.log("  - Total entries:", stats.total)
      console.log("  - Completed:", stats.completed)
      console.log("  - Processing:", stats.processing)
      console.log("  - Failed:", stats.failed)
      console.log("  - Pending:", stats.pending)
      console.log("  - Processing time:", `${processingTime}ms`)

      return NextResponse.json({
        success: true,
        statistics: stats,
        entries: entries.map((entry) => ({
          id: entry.id,
          pet_name: entry.pet_name,
          title: entry.title,
          caption_status: entry.caption_status,
          caption_processing_started_at: entry.caption_processing_started_at,
          caption_processing_completed_at: entry.caption_processing_completed_at,
          caption_error: entry.caption_error,
          caption_files: {
            vtt_url: entry.caption_vtt_url,
            srt_url: entry.caption_srt_url,
          },
          cloudinary_audio_public_id: entry.cloudinary_audio_public_id,
          created_at: entry.created_at,
        })),
        processingTime: `${processingTime}ms`,
      })
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("💥 =====================================")
    console.error("💥 CAPTION STATUS API ERROR")
    console.error("💥 Error:", error)
    console.error("💥 Processing time:", `${processingTime}ms`)
    console.error("💥 =====================================")

    return NextResponse.json(
      {
        error: "Caption status request failed",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTime: `${processingTime}ms`,
      },
      { status: 500 },
    )
  }
}

/**
 * POST endpoint for triggering caption generation retry
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("🔄 =====================================")
  console.log("🔄 CAPTION RETRY API REQUEST")
  console.log("🔄 Timestamp:", new Date().toISOString())
  console.log("🔄 =====================================")

  try {
    const body = await request.json()
    const { entryId } = body

    if (!entryId) {
      return NextResponse.json({ error: "entryId is required" }, { status: 400 })
    }

    console.log("🔄 Retrying caption generation for entry:", entryId)

    // Fetch entry data
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from("diary_entries")
      .select("id, voiceover_url, caption_status")
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      console.error("❌ Entry not found:", fetchError)
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    if (!entry.voiceover_url) {
      console.error("❌ No voiceover URL found for entry")
      return NextResponse.json({ error: "No voiceover URL found" }, { status: 400 })
    }

    console.log("📊 Entry data for retry:")
    console.log("  - Current caption status:", entry.caption_status)
    console.log("  - Has voiceover URL:", !!entry.voiceover_url)

    // Reset caption status to trigger retry
    const { error: resetError } = await supabaseAdmin
      .from("diary_entries")
      .update({
        caption_status: "processing",
        caption_processing_started_at: new Date().toISOString(),
        caption_processing_completed_at: null,
        caption_error: null,
        caption_transcript: null,
        caption_vtt_url: null,
        caption_srt_url: null,
      })
      .eq("id", entryId)

    if (resetError) {
      console.error("❌ Failed to reset caption status:", resetError)
      return NextResponse.json({ error: "Failed to reset caption status" }, { status: 500 })
    }

    console.log("✅ Caption status reset to processing")

    // Trigger merged video API which will handle audio upload with caption generation
    try {
      const mergedVideoResponse = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      })

      const processingTime = Date.now() - startTime

      if (mergedVideoResponse.ok) {
        console.log("✅ Caption retry triggered successfully")
        console.log("  - Processing time:", `${processingTime}ms`)

        return NextResponse.json({
          success: true,
          entryId,
          message: "Caption generation retry triggered successfully",
          processingTime: `${processingTime}ms`,
        })
      } else {
        const errorText = await mergedVideoResponse.text()
        console.warn("⚠️ Failed to trigger caption retry:", errorText)

        return NextResponse.json(
          {
            success: false,
            entryId,
            error: "Failed to trigger caption retry",
            details: errorText,
            processingTime: `${processingTime}ms`,
          },
          { status: 500 },
        )
      }
    } catch (triggerError) {
      const processingTime = Date.now() - startTime
      console.error("❌ Error triggering caption retry:", triggerError)

      return NextResponse.json(
        {
          success: false,
          entryId,
          error: "Error triggering caption retry",
          details: triggerError instanceof Error ? triggerError.message : "Unknown error",
          processingTime: `${processingTime}ms`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("💥 =====================================")
    console.error("💥 CAPTION RETRY API ERROR")
    console.error("💥 Error:", error)
    console.error("💥 Processing time:", `${processingTime}ms`)
    console.error("💥 =====================================")

    return NextResponse.json(
      {
        error: "Caption retry request failed",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTime: `${processingTime}ms`,
      },
      { status: 500 },
    )
  }
}

/**
 * OPTIONS endpoint for CORS
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  )
}
