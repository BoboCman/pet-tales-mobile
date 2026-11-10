import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"

async function handler(request: Request, context: any & { params: { id: string } }) {
  try {
    const { userId: adminId } = context
    const userId = context.params.id

    // Log admin action
    await logAdminAction(adminId, "view_user_detail", { userId })

    // Get user data
    const { data: user, error: userError } = await supabaseAdmin.from("users").select("*").eq("id", userId).single()

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      )
    }

    // Get user's pets
    const { data: pets } = await supabaseAdmin
      .from("pets")
      .select("id, name, type, breed, avatar_url, photo_url, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Get user's videos with pet info
    const { data: videos } = await supabaseAdmin
      .from("diary_entries")
      .select(
        `
        id,
        title,
        created_at,
        view_count,
        like_count,
        is_public,
        merged_video_url,
        merged_video_supabase_url,
        pets:pet_id (
          id,
          name,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Get credit transactions
    const { data: transactions } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, amount, transaction_type, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    // Where they came from (saved at signup from utm tags, fbclid or ?ref=)
    let attribution: Record<string, string> | null = null
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      attribution = (authUser?.user?.user_metadata?.attribution as Record<string, string>) || null
    } catch {
      attribution = null
    }

    // Calculate statistics
    const totalVideos = videos?.length || 0
    const totalViews = videos?.reduce((sum, v) => sum + (v.view_count || 0), 0) || 0
    const totalLikes = videos?.reduce((sum, v) => sum + (v.like_count || 0), 0) || 0
    const publicVideos = videos?.filter((v) => v.is_public).length || 0
    const privateVideos = totalVideos - publicVideos
    const avgViewsPerVideo = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0

    // Calculate days since signup
    const signupDate = new Date(user.created_at)
    const now = new Date()
    const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24))

    // Determine if user is active (has activity in last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentVideos = videos?.filter((v) => new Date(v.created_at) > thirtyDaysAgo).length || 0
    const isActive = recentVideos > 0 || daysSinceSignup < 7

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          signupDate: user.created_at,
          lastActive: user.updated_at,
          daysSinceSignup,
          isActive,
          isAdmin: user.is_admin || false,
          attribution,
        },
        credits: {
          free: user.free_credits || 0,
          purchased: user.purchased_credits || 0,
          total: (user.free_credits || 0) + (user.purchased_credits || 0),
          welcomeGranted: user.welcome_credits_granted || false,
          lastWeeklyDate: user.last_weekly_credit_date,
        },
        subscription: {
          customerId: user.stripe_customer_id,
          status: user.subscription_status,
          tier: user.subscription_tier,
        },
        transactions: transactions || [],
        pets: pets || [],
        videos: videos || [],
        stats: {
          totalVideos,
          totalViews,
          totalLikes,
          publicVideos,
          privateVideos,
          avgViewsPerVideo,
        },
      },
    })
  } catch (error) {
    console.error("[Admin User Detail] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user details",
      },
      { status: 500 },
    )
  }
}

export const GET = requireAdmin(handler)
