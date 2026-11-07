import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"
import { getPlanById } from "@/lib/pricing-config"

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

    // Subscribers (from the users table, which the Stripe webhook keeps in sync). Money lives in Stripe.
    const { data: subscribers } = await supabaseAdmin
      .from("users")
      .select("subscription_tier, subscription_status, subscription_cancel_at_period_end")
      .in("subscription_status", ["active", "trialing", "past_due"])
    const byPlan: Record<string, number> = {}
    let estimatedMrr = 0
    let pastDue = 0
    let cancelling = 0
    for (const sub of subscribers ?? []) {
      const plan = getPlanById(sub.subscription_tier ?? "")
      byPlan[plan?.name ?? "Unknown"] = (byPlan[plan?.name ?? "Unknown"] ?? 0) + 1
      if (sub.subscription_status === "past_due") pastDue++
      else if (plan) estimatedMrr += plan.monthlyPrice
      if (sub.subscription_cancel_at_period_end) cancelling++
    }

    // Tales still unused across all accounts (head-less sum; fine at this scale)
    const { data: balances } = await supabaseAdmin.from("users").select("free_credits, purchased_credits")
    const talesRemaining =
      balances?.reduce((sum, user) => sum + (user.free_credits || 0) + (user.purchased_credits || 0), 0) || 0

    // Engagement (head: true returns only the count)
    const { count: totalViews } = await supabaseAdmin.from("view_logs").select("id", { count: "exact", head: true })
    const { count: totalLikes } = await supabaseAdmin
      .from("diary_entry_likes")
      .select("id", { count: "exact", head: true })

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
        subscriptions: {
          total: subscribers?.length || 0,
          byPlan,
          pastDue,
          cancelling,
          estimatedMrr: Math.round(estimatedMrr * 100) / 100,
        },
        tales: {
          remaining: talesRemaining,
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
