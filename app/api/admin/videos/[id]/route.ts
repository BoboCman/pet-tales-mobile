import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"

type RouteContext = {
  userId: string
  userEmail: string
  isAdmin: boolean
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/videos/[id]
 *
 * Returns detailed information about a specific video
 */
async function getHandler(request: NextRequest, context: RouteContext) {
  const { userId: adminId, params: paramsPromise } = context
  const params = await paramsPromise
  const videoId = params.id

  try {
    // === ENHANCED DIAGNOSTIC LOGGING START ===
    console.log("=== ADMIN VIDEO DETAIL DEBUG START ===")
    console.log("📹 Requested Video ID:", videoId)
    console.log("👤 Admin User ID:", adminId)
    console.log("🔐 Auth Context:", {
      userId: context.userId,
      userEmail: context.userEmail,
      isAdmin: context.isAdmin,
    })

    // Test if supabaseAdmin can execute ANY query (RLS bypass test)
    console.log("🧪 Testing supabaseAdmin connection and RLS bypass...")
    const { data: testData, error: testError } = await supabaseAdmin.from("diary_entries").select("id").limit(1)

    if (testError) {
      console.error("❌ CRITICAL: supabaseAdmin test query FAILED")
      console.error("❌ Error code:", testError.code)
      console.error("❌ Error message:", testError.message)
      console.error("❌ Error details:", JSON.stringify(testError.details))
      console.error("❌ This indicates: RLS is blocking OR service role key is invalid/missing")

      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
          details: testError.message,
          errorCode: testError.code,
          hint: "supabaseAdmin cannot bypass RLS. Verify SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.",
        },
        { status: 500 },
      )
    }

    console.log("✅ supabaseAdmin connection test PASSED - RLS bypass working")
    console.log("📊 Test query returned:", testData?.length || 0, "records")
    console.log("🔍 Now fetching specific video:", videoId)
    // === ENHANCED DIAGNOSTIC LOGGING END ===

    // Original video query with enhanced error logging
    const { data: video, error: videoError } = await supabaseAdmin
      .from("diary_entries")
      .select("*")
      .eq("id", videoId)
      .single()

    if (videoError) {
      console.error("❌ Video query FAILED for ID:", videoId)
      console.error("❌ Error code:", videoError.code)
      console.error("❌ Error message:", videoError.message)
      console.error("❌ Error details:", JSON.stringify(videoError.details))
      console.error("❌ Error hint:", videoError.hint)
    }

    if (!video) {
      console.error("❌ Video NOT FOUND for ID:", videoId)
      return NextResponse.json(
        {
          success: false,
          error: "Video not found",
          videoId: videoId,
        },
        { status: 404 },
      )
    }

    console.log("✅ Video found successfully")
    console.log("📹 Video details:", {
      id: video.id,
      title: video.title,
      user_id: video.user_id,
      pet_id: video.pet_id,
      created_at: video.created_at,
    })
    console.log("🐾 Fetching related data...")

    let pet = null
    if (video.pet_id) {
      const { data: petData } = await supabaseAdmin.from("pets").select("*").eq("id", video.pet_id).single()
      pet = petData
    }

    // Fetch user data
    let user = null
    if (video.user_id) {
      const { data: userData } = await supabaseAdmin.from("users").select("id, email").eq("id", video.user_id).single()
      user = userData
    }

    // Get view logs
    const { count: totalViews } = await supabaseAdmin
      .from("view_logs")
      .select("*", { count: "exact", head: true })
      .eq("diary_entry_id", videoId)

    // Get like count
    const { count: totalLikes } = await supabaseAdmin
      .from("diary_entry_likes")
      .select("*", { count: "exact", head: true })
      .eq("diary_entry_id", videoId)

    await logAdminAction(adminId, "view_video_detail", {
      videoId,
      videoTitle: video.title,
    })

    console.log("[Admin Video Detail] Successfully fetched video details")

    return NextResponse.json({
      success: true,
      data: {
        video: {
          id: video.id,
          title: video.title || "Untitled Tale",
          content: video.content,
          createdAt: video.created_at,
          viewCount: totalViews || video.view_count || 0,
          likeCount: totalLikes || video.like_count || 0,
          isPublic: video.is_public || false,
          videoUrl:
            video.merged_video_supabase_url || video.merged_video_url || video.optimized_video_url || video.video_url,
          thumbnailUrl: video.thumbnail_url,
          narrationStyle: video.narration_style || "unknown",
          narrationGenre: video.narration_genre || "unknown",
          status: video.merged_video_status || video.status || "unknown",
          mergeError: video.merged_video_error || null,
          compressionStatus: video.compression_status || null,
        },
        pet: {
          id: pet?.id || video.pet_id,
          name: pet?.name || "Unknown Pet",
          type: pet?.type || "pet",
          breed: pet?.breed || null,
          avatarUrl: pet?.avatar_url || pet?.photo_url || pet?.image_url || null,
        },
        creator: {
          id: user?.id || video.user_id,
          email: user?.email || "Unknown",
        },
      },
    })
  } catch (error) {
    console.error("[Admin Video Detail] Unexpected error:", error)
    console.error("[Admin Video Detail] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch video details",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/videos/[id]
 *
 * Deletes a video and its associated data
 */
async function deleteHandler(request: NextRequest, context: RouteContext) {
  const { userId: adminId, params: paramsPromise } = context
  const params = await paramsPromise
  const videoId = params.id

  try {
    console.log("[Admin Video Delete] Deleting video:", videoId)

    // Get video info before deleting (for audit log)
    const { data: video } = await supabaseAdmin
      .from("diary_entries")
      .select("title, user_id")
      .eq("id", videoId)
      .single()

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 })
    }

    // Delete the video (cascade will handle related records)
    const { error: deleteError } = await supabaseAdmin.from("diary_entries").delete().eq("id", videoId)

    if (deleteError) {
      console.error("[Admin Video Delete] Error deleting video:", deleteError)
      throw deleteError
    }

    await logAdminAction(adminId, "delete_video", {
      videoId,
      videoTitle: video.title,
      userId: video.user_id,
    })

    console.log("[Admin Video Delete] Successfully deleted video")

    return NextResponse.json({
      success: true,
      message: "Video deleted successfully",
    })
  } catch (error) {
    console.error("[Admin Video Delete] Unexpected error:", error)
    console.error("[Admin Video Delete] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete video",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/admin/videos/[id]
 *
 * Updates video properties (currently just is_public toggle)
 */
async function patchHandler(request: NextRequest, context: RouteContext) {
  const { userId: adminId, params: paramsPromise } = context
  const params = await paramsPromise
  const videoId = params.id

  try {
    const body = await request.json()
    const { isPublic } = body

    console.log("[Admin Video Update] Updating video:", videoId, { isPublic })

    if (typeof isPublic !== "boolean") {
      return NextResponse.json({ success: false, error: "Invalid isPublic value" }, { status: 400 })
    }

    // Update the video
    const { data: video, error: updateError } = await supabaseAdmin
      .from("diary_entries")
      .update({ is_public: isPublic })
      .eq("id", videoId)
      .select("title")
      .single()

    if (updateError) {
      console.error("[Admin Video Update] Error updating video:", updateError)
      throw updateError
    }

    await logAdminAction(adminId, "update_video_visibility", {
      videoId,
      videoTitle: video?.title,
      isPublic,
    })

    console.log("[Admin Video Update] Successfully updated video")

    return NextResponse.json({
      success: true,
      message: `Video ${isPublic ? "published" : "unpublished"} successfully`,
    })
  } catch (error) {
    console.error("[Admin Video Update] Unexpected error:", error)
    console.error("[Admin Video Update] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update video",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: 500 },
    )
  }
}

export const GET = requireAdmin(getHandler)
export const DELETE = requireAdmin(deleteHandler)
export const PATCH = requireAdmin(patchHandler)
