import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"

async function handler(request: Request, context: any) {
  try {
    const { userId } = context

    // Log admin action
    await logAdminAction(userId, "view_dashboard_metrics", {})

    // Get total users
    const { count: totalUsers } = await supabaseAdmin.from("users").select("*", { count: "exact", head: true })

    // Get new users today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: newUsersToday } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString())

    // Get new users this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    weekAgo.setHours(0, 0, 0, 0)
    const { count: newUsersThisWeek } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString())

    // Get user growth trend (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { count: usersLast30Days } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString())

    // Get total videos
    const { count: totalVideos } = await supabaseAdmin.from("diary_entries").select("*", { count: "exact", head: true })

    // Get videos created today
    const { count: videosToday } = await supabaseAdmin
      .from("diary_entries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString())

    // Get videos created this week
    const { count: videosThisWeek } = await supabaseAdmin
      .from("diary_entries")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString())

    // Get credit statistics
    const { data: creditStats } = await supabaseAdmin.rpc("get_credit_statistics")

    // Get total credits distributed (sum of all positive transactions)
    const { data: creditTransactions } = await supabaseAdmin
      .from("credit_transactions")
      .select("amount")
      .gt("amount", 0)

    const totalCreditsDistributed = creditTransactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0

    // Get total credits used (sum of all negative transactions)
    const { data: usedTransactions } = await supabaseAdmin.from("credit_transactions").select("amount").lt("amount", 0)

    const totalCreditsUsed = Math.abs(usedTransactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0)

    // Get current total credits remaining (sum of all user balances)
    const { data: users } = await supabaseAdmin.from("users").select("free_credits, purchased_credits")

    const totalCreditsRemaining =
      users?.reduce((sum, user) => sum + (user.free_credits || 0) + (user.purchased_credits || 0), 0) || 0

    // Get engagement metrics
    const { data: viewLogs } = await supabaseAdmin.from("view_logs").select("id", { count: "exact", head: true })

    const { count: totalViews } = viewLogs || { count: 0 }

    const { data: likeLogs } = await supabaseAdmin
      .from("diary_entry_likes")
      .select("id", { count: "exact", head: true })

    const { count: totalLikes } = likeLogs || { count: 0 }

    // Calculate average views per video
    const avgViewsPerVideo = totalVideos ? Math.round((totalViews || 0) / totalVideos) : 0

    // Calculate user growth percentage
    const usersBeforeLast30Days = (totalUsers || 0) - (usersLast30Days || 0)
    const userGrowthPercentage =
      usersBeforeLast30Days > 0 ? Math.round(((usersLast30Days || 0) / usersBeforeLast30Days) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers || 0,
          newToday: newUsersToday || 0,
          newThisWeek: newUsersThisWeek || 0,
          growthPercentage: userGrowthPercentage,
        },
        videos: {
          total: totalVideos || 0,
          createdToday: videosToday || 0,
          createdThisWeek: videosThisWeek || 0,
        },
        credits: {
          distributed: totalCreditsDistributed,
          used: totalCreditsUsed,
          remaining: totalCreditsRemaining,
        },
        engagement: {
          totalViews: totalViews || 0,
          totalLikes: totalLikes || 0,
          avgViewsPerVideo,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[Admin Dashboard Metrics] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dashboard metrics",
      },
      { status: 500 },
    )
  }
}

export const GET = requireAdmin(handler)
