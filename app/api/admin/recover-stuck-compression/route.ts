import { type NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { createClient } from "@supabase/supabase-js"
import { getAppBaseUrl } from "@/lib/utils/app-url"
import { internalAuthHeaders } from "@/lib/api/internal-auth"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export const maxDuration = 60

/**
 * POST /api/admin/recover-stuck-compression
 * 
 * Recovers entries stuck in compression_status: "processing" by checking
 * if the video actually exists on Cloudinary and updating the DB accordingly.
 * 
 * Body: { entryId: string } or { recoverAll: true }
 */
export async function POST(request: NextRequest) {
  try {
    // Simple admin auth check
    const adminPassword = request.headers.get("x-admin-password")
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, recoverAll } = body

    if (!entryId && !recoverAll) {
      return NextResponse.json(
        { error: "Must provide entryId or recoverAll: true" },
        { status: 400 }
      )
    }

    // Find stuck entries
    let query = supabaseAdmin
      .from("diary_entries")
      .select("id, cloudinary_public_id, compression_status, compression_started_at")
      .eq("compression_status", "processing")
      .not("cloudinary_public_id", "is", null)

    if (entryId) {
      query = query.eq("id", entryId)
    }

    const { data: stuckEntries, error: fetchError } = await query

    if (fetchError) {
      console.error("Failed to fetch stuck entries:", fetchError)
      return NextResponse.json({ error: "Database fetch failed" }, { status: 500 })
    }

    if (!stuckEntries || stuckEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stuck entries found",
        recovered: 0,
      })
    }

    console.log(`Found ${stuckEntries.length} stuck entries to recover`)

    const results: Array<{
      entryId: string
      status: "recovered" | "not_found" | "error"
      message: string
      url?: string
    }> = []

    for (const entry of stuckEntries) {
      console.log(`\nChecking entry ${entry.id}...`)
      console.log(`  - Cloudinary public_id: ${entry.cloudinary_public_id}`)

      try {
        // Check if the video exists on Cloudinary
        const resource = await cloudinary.api.resource(entry.cloudinary_public_id, {
          resource_type: "video",
        })

        if (resource && resource.secure_url) {
          console.log(`  - Found on Cloudinary! URL: ${resource.secure_url.substring(0, 80)}...`)
          console.log(`  - Duration: ${resource.duration}s, Size: ${resource.bytes} bytes`)

          // Update the database
          const { error: updateError } = await supabaseAdmin
            .from("diary_entries")
            .update({
              optimized_video_url: resource.secure_url,
              compression_status: "completed",
              compression_completed_at: new Date().toISOString(),
              compression_error: null,
              compressed_file_size: resource.bytes,
            })
            .eq("id", entry.id)

          if (updateError) {
            console.error(`  - Failed to update DB:`, updateError)
            results.push({
              entryId: entry.id,
              status: "error",
              message: `DB update failed: ${updateError.message}`,
            })
          } else {
            console.log(`  - DB updated successfully!`)
            results.push({
              entryId: entry.id,
              status: "recovered",
              message: "Video found on Cloudinary, DB updated",
              url: resource.secure_url,
            })

            // Now check if we should auto-trigger the merge
            const { data: fullEntry } = await supabaseAdmin
              .from("diary_entries")
              .select("voiceover_url, merged_video_status")
              .eq("id", entry.id)
              .single()

            if (
              fullEntry?.voiceover_url &&
              (!fullEntry.merged_video_status ||
                fullEntry.merged_video_status === "pending" ||
                fullEntry.merged_video_status === "not_requested")
            ) {
              console.log(`  - TTS is ready, auto-triggering merge...`)

              try {
                const mergeResponse = await fetch(
                  `${getAppBaseUrl()}/api/cloudinary/merged-video`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
                    body: JSON.stringify({ entryId: entry.id }),
                  }
                )

                if (mergeResponse.ok) {
                  console.log(`  - Merge triggered successfully!`)
                } else {
                  console.warn(`  - Merge trigger failed:`, await mergeResponse.text())
                }
              } catch (mergeError) {
                console.error(`  - Error triggering merge:`, mergeError)
              }
            }
          }
        } else {
          console.log(`  - Video exists but no secure_url`)
          results.push({
            entryId: entry.id,
            status: "error",
            message: "Video exists on Cloudinary but has no URL",
          })
        }
      } catch (cloudinaryError: any) {
        if (cloudinaryError.http_code === 404) {
          console.log(`  - Video NOT found on Cloudinary`)

          // Mark as failed so user can retry
          await supabaseAdmin
            .from("diary_entries")
            .update({
              compression_status: "failed",
              compression_error: "Video not found on Cloudinary - please retry upload",
            })
            .eq("id", entry.id)

          results.push({
            entryId: entry.id,
            status: "not_found",
            message: "Video not found on Cloudinary, marked as failed for retry",
          })
        } else {
          console.error(`  - Cloudinary API error:`, cloudinaryError)
          results.push({
            entryId: entry.id,
            status: "error",
            message: `Cloudinary error: ${cloudinaryError.message}`,
          })
        }
      }
    }

    const recovered = results.filter((r) => r.status === "recovered").length
    const notFound = results.filter((r) => r.status === "not_found").length
    const errors = results.filter((r) => r.status === "error").length

    return NextResponse.json({
      success: true,
      summary: {
        total: stuckEntries.length,
        recovered,
        notFound,
        errors,
      },
      results,
    })
  } catch (error: any) {
    console.error("Recovery endpoint error:", error)
    return NextResponse.json(
      { error: error.message || "Recovery failed" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/recover-stuck-compression
 * 
 * Returns a list of entries currently stuck in processing state.
 */
export async function GET(request: NextRequest) {
  try {
    const adminPassword = request.headers.get("x-admin-password")
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: stuckEntries, error } = await supabaseAdmin
      .from("diary_entries")
      .select(`
        id,
        pet_name,
        title,
        compression_status,
        compression_started_at,
        cloudinary_public_id,
        voiceover_url,
        merged_video_status,
        created_at
      `)
      .eq("compression_status", "processing")
      .order("compression_started_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: stuckEntries?.length || 0,
      entries: stuckEntries?.map((e) => ({
        ...e,
        stuckFor: e.compression_started_at
          ? `${Math.round((Date.now() - new Date(e.compression_started_at).getTime()) / 60000)} minutes`
          : "unknown",
        hasCloudinaryId: !!e.cloudinary_public_id,
        hasTTS: !!e.voiceover_url,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
