import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"

async function handler(request: Request, context: any) {
  try {
    const { userId } = context
    const { searchParams } = new URL(request.url)

    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "25")
    const search = searchParams.get("search") || ""
    const role = searchParams.get("role") || ""

    console.log("[v0] Admin Users API - Request params:", { page, limit, search, role })

    await logAdminAction(userId, "list_users", { page, limit, search, role })

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabaseAdmin.from("users").select(
      `
        id,
        email,
        full_name,
        is_admin,
        created_at,
        updated_at
      `,
      { count: "exact" },
    )

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    if (role && role !== "all") {
      if (role === "admin") {
        query = query.eq("is_admin", true)
      } else if (role === "user") {
        query = query.eq("is_admin", false)
      }
    }

    query = query.order("created_at", { ascending: false }).range(from, to)

    console.log("[v0] Executing users query...")
    const { data: users, error, count } = await query

    if (error) {
      console.error("[v0] Admin Users API - Database error:", error)
      throw error
    }

    console.log("[v0] Users fetched:", users?.length, "Total count:", count)

    const userIds = users?.map((u) => u.id) || []

    const [petCounts, videoCounts] = await Promise.all([
      Promise.all(
        userIds.map(async (userId) => {
          const { count } = await supabaseAdmin
            .from("pets")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
          return { userId, count: count || 0 }
        }),
      ),
      Promise.all(
        userIds.map(async (userId) => {
          const { count } = await supabaseAdmin
            .from("diary_entries")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
          return { userId, count: count || 0 }
        }),
      ),
    ])

    const petCountMap = new Map(petCounts.map(({ userId, count }) => [userId, count]))
    const videoCountMap = new Map(videoCounts.map(({ userId, count }) => [userId, count]))

    const enrichedUsers =
      users?.map((user) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.is_admin ? "admin" : "user",
        created_at: user.created_at,
        last_sign_in_at: user.updated_at, // Using updated_at as proxy for last_sign_in_at
        pets_count: petCountMap.get(user.id) || 0,
        videos_count: videoCountMap.get(user.id) || 0,
      })) || []

    const totalPages = Math.ceil((count || 0) / limit)

    console.log("[v0] Returning enriched users:", enrichedUsers.length)

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    console.error("[v0] Admin Users API - Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch users",
      },
      { status: 500 },
    )
  }
}

export const GET = requireAdmin(handler)
