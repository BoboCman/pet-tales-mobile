import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"
import { getTaleHealth } from "@/lib/tale-health"
import { getTaleCost, type TaleCost } from "@/lib/tale-cost"

/**
 * GET /api/admin/videos
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - search: string (search by title or pet name)
 * - visibility: 'all' | 'public' | 'private' | 'attention' (failed, stuck, or wrong length) (default: 'all')
 * - sortBy: string (default: 'created_at')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 * - voice: string (filter by narration style)
 * - vibe: string (filter by narration genre)
 * - petType: string (filter by pet type)
 * - petGender: string (filter by pet gender)
 * - petAge: string (filter by pet age)
 * - breed: string (filter by pet breed)
 *
 * Returns paginated list of videos with pet and creator info
 */
async function handler(request: NextRequest, context: any) {
  const { userId: adminId, userEmail: adminEmail } = context
  const { searchParams } = new URL(request.url)

  try {
    // Parse query parameters
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const visibility = searchParams.get("visibility") || "all"
    const sortBy = searchParams.get("sortBy") || "created_at"
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc"
    const voice = searchParams.get("voice") || ""
    const vibe = searchParams.get("vibe") || ""
    const petType = searchParams.get("petType") || ""
    const petGender = searchParams.get("petGender") || ""
    const petAge = searchParams.get("petAge") || ""
    const breed = searchParams.get("breed") || ""

    console.log("[v0] [Admin Videos] Fetching video list:", {
      page,
      limit,
      search,
      visibility,
      sortBy,
      sortOrder,
      voice,
      vibe,
      petType,
      petGender,
      petAge,
      breed,
      adminEmail,
    })

    // Calculate pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabaseAdmin.from("diary_entries").select(
      `
        id,
        title,
        content,
        created_at,
        view_count,
        like_count,
        is_public,
        merged_video_url,
        merged_video_supabase_url,
        thumbnail_url,
        narration_style,
        narration_genre,
        status,
        user_id,
        pet_id,
        pet_type,
        pet_gender,
        pet_age,
        pet_breed,
        merged_video_status,
        merged_video_error,
        merged_processing_started_at,
        merge_details
      `,
      { count: "exact" },
    )

    // Apply visibility filter
    if (visibility === "public") {
      query = query.eq("is_public", true)
    } else if (visibility === "private") {
      query = query.eq("is_public", false)
    } else if (visibility === "attention") {
      const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      query = query.or(
        `merged_video_status.eq.failed,merge_details->>length_ok.eq.false,and(merged_video_status.eq.processing,merged_processing_started_at.lt.${stuckBefore})`,
      )
    }

    // Apply search filter (title only for now)
    if (search && search.trim().length > 0) {
      query = query.ilike("title", `%${search}%`)
    }

    if (voice && voice !== "all") {
      query = query.eq("narration_style", voice)
    }
    if (vibe && vibe !== "all") {
      query = query.eq("narration_genre", vibe)
    }

    if (petType && petType !== "all") {
      query = query.eq("pet_type", petType)
    }
    if (petGender && petGender !== "all") {
      query = query.eq("pet_gender", petGender)
    }
    if (petAge && petAge !== "all") {
      query = query.eq("pet_age", petAge)
    }
    if (breed && breed.trim() !== "") {
      query = query.ilike("pet_breed", `%${breed.trim()}%`)
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" })

    // Apply pagination
    query = query.range(from, to)

    console.log("[v0] [Admin Videos] Executing query...")

    const { data: videos, error, count } = await query

    if (error) {
      console.error("[v0] [Admin Videos] Database error:", error)
      throw error
    }

    console.log("[v0] [Admin Videos] Fetched diary entries:", videos?.length || 0, "Total count:", count)

    const petIds = (videos || []).map((v) => v.pet_id).filter((id): id is string => Boolean(id))
    const userIds = (videos || []).map((v) => v.user_id).filter((id): id is string => Boolean(id))

    console.log("[v0] [Admin Videos] Fetching related data - Pets:", petIds.length, "Users:", userIds.length)

    let pets: any[] = []
    let users: any[] = []

    if (petIds.length > 0) {
      const { data: petsData, error: petsError } = await supabaseAdmin
        .from("pets")
        .select("id, name, type, breed, gender, age, avatar_url, photo_url, image_url, user_id")
        .in("id", petIds)

      if (petsError) {
        console.error("[Admin Videos] Error fetching pets:", petsError)
      } else {
        pets = petsData || []
        console.log("[Admin Videos] Fetched pets:", pets.length)
      }
    }

    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .in("id", userIds)

      if (usersError) {
        console.error("[v0] [Admin Videos] Error fetching users:", usersError)
      } else {
        users = usersData || []
        console.log("[v0] [Admin Videos] Fetched users:", users.length)
      }
    }

    // Create lookup maps
    const petsMap = new Map(pets.map((p) => [p.id, p]))
    const usersMap = new Map(users.map((u) => [u.id, u]))

    const transformedVideos = (videos || []).map((video) => {
      const pet = video.pet_id ? petsMap.get(video.pet_id) : null
      const user = video.user_id ? usersMap.get(video.user_id) : null

      return {
        id: video.id,
        title: video.title || "Untitled Tale",
        createdAt: video.created_at,
        viewCount: video.view_count || 0,
        likeCount: video.like_count || 0,
        isPublic: video.is_public || false,
        videoUrl:
          video.merged_video_supabase_url || video.merged_video_url || video.optimized_video_url || video.video_url,
        thumbnailUrl: video.thumbnail_url,
        narrationStyle: video.narration_style || "unknown",
        narrationGenre: video.narration_genre || "unknown",
        status: video.status || "unknown",
        health: getTaleHealth(video as any),
        cost: getTaleCost((video as any).merge_details),
        userId: video.user_id,
        pet: {
          id: pet?.id || video.pet_id,
          name: pet?.name || "Unknown Pet",
          type: pet?.type || "pet",
          avatarUrl: pet?.avatar_url || pet?.photo_url || pet?.image_url || null,
        },
        creator: {
          email: user?.email || "Unknown",
        },
      }
    })

    await logAdminAction(adminId, "view_video_list", {
      page,
      limit,
      search,
      visibility,
      voice,
      vibe,
      petType,
      petGender,
      petAge,
      breed,
      resultCount: transformedVideos.length,
    })

    console.log("[Admin Videos] Successfully fetched video list:", {
      totalVideos: count,
      returnedVideos: transformedVideos.length,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })

    const total = count || 0
    const totalPages = Math.ceil(total / limit)
    const costSummary = await getCostSummary()

    return NextResponse.json({
      success: true,
      data: {
        videos: transformedVideos,
        costSummary,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    console.error("[v0] [Admin Videos] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch video list",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/** Average Cloudinary cost per tale over the last 7 and 30 days (tales with a merge log only). */
async function getCostSummary() {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const { data, error } = await supabaseAdmin
      .from("diary_entries")
      .select("created_at, merge_details" as any)
      .gte("created_at", since)
      .not("merge_details", "is", null)
      .limit(2000)
    if (error) throw error
    const sum = (rows: { created_at: string; cost: TaleCost }[]) => {
      const credits = rows.reduce((t, r) => t + r.cost.credits, 0)
      return {
        tales: rows.length,
        totalCredits: credits,
        avgCredits: rows.length ? credits / rows.length : 0,
        avgDollars: rows.length ? rows.reduce((t, r) => t + r.cost.dollars, 0) / rows.length : 0,
      }
    }
    const rows = ((data as any[]) || [])
      .map((r) => ({ created_at: r.created_at as string, cost: getTaleCost(r.merge_details) }))
      .filter((r): r is { created_at: string; cost: TaleCost } => r.cost !== null)
    return { last7: sum(rows.filter((r) => Date.parse(r.created_at) >= weekAgo)), last30: sum(rows) }
  } catch (error) {
    console.warn("[Admin Videos] Could not build cost summary:", error)
    return null
  }
}

export const GET = requireAdmin(handler)
