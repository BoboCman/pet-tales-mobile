import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { grantWeeklyCredit } from "@/lib/credits/operations-admin"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes max execution time

/**
 * Weekly credit grant cron job
 *
 * Runs daily at 2 AM UTC to check all users and grant weekly credits if eligible
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access
 *
 * @returns JSON response with grant statistics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // ============================================================
  // SECURITY: Verify cron secret
  // ============================================================
  const authHeader = request.headers.get("authorization")
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET) {
    console.error("[Cron] CRON_SECRET not configured in environment variables")
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 })
  }

  if (authHeader !== expectedAuth) {
    console.warn("[Cron] Unauthorized access attempt")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ============================================================
  // FETCH ALL USERS
  // ============================================================
  console.log("[Cron] Starting weekly credit grant process...")

  const { data: users, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("id, email, free_credits, last_weekly_credit_date")
    .order("created_at", { ascending: true })

  if (fetchError) {
    console.error("[Cron] Failed to fetch users:", fetchError)
    return NextResponse.json({ error: "Failed to fetch users", details: fetchError.message }, { status: 500 })
  }

  if (!users || users.length === 0) {
    console.log("[Cron] No users found")
    return NextResponse.json({
      success: true,
      granted: 0,
      skipped: 0,
      errors: 0,
      total: 0,
      duration_ms: Date.now() - startTime,
    })
  }

  // ============================================================
  // PROCESS EACH USER
  // ============================================================
  let granted = 0
  let skipped = 0
  let errors = 0
  const errorDetails: Array<{ userId: string; error: string }> = []

  console.log(`[Cron] Processing ${users.length} users...`)

  for (const user of users) {
    try {
      const result = await grantWeeklyCredit(user.id)

      if (result.error) {
        errors++
        errorDetails.push({
          userId: user.id,
          error: result.error.message,
        })
        console.error(`[Cron] Error granting credit to user ${user.id}:`, result.error)
      } else if (result.already_granted) {
        skipped++
        // User not eligible yet (hasn't been 7 days)
      } else {
        granted++
        console.log(`[Cron] ✓ Granted weekly credit to user ${user.id} (email: ${user.email})`)
      }
    } catch (error) {
      errors++
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      errorDetails.push({
        userId: user.id,
        error: errorMessage,
      })
      console.error(`[Cron] Exception processing user ${user.id}:`, error)
    }
  }

  // ============================================================
  // RETURN RESULTS
  // ============================================================
  const duration = Date.now() - startTime
  const result = {
    success: true,
    granted,
    skipped,
    errors,
    total: users.length,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    ...(errorDetails.length > 0 && { error_details: errorDetails }),
  }

  console.log(`[Cron] Weekly credit grant completed:`, result)

  return NextResponse.json(result)
}
