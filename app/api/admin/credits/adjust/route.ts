import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { withRateLimit } from "@/lib/api/auth-middleware"
import { adminRateLimiter } from "@/lib/api/rate-limits"
import { logAdminAction, logApiRequest } from "@/lib/api/audit-logger"
import { withSecurityHeaders } from "@/lib/api/security-headers"
import type { AdminContext } from "@/lib/api/types"

const handler = requireAdmin(async (request: Request, context: AdminContext) => {
  const startTime = Date.now()

  try {
    // Parse request body
    const { userEmail, adjustmentType, amount, reason, adminEmail } = await request.json()

    // Validation
    if (!userEmail || !adjustmentType || !amount || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })
    }

    if (reason.length < 10) {
      return NextResponse.json({ error: "Reason must be at least 10 characters" }, { status: 400 })
    }

    if (amount > 1000) {
      return NextResponse.json({ error: "Amount too large. Contact developer for bulk adjustments." }, { status: 400 })
    }

    // Create admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, free_credits, purchased_credits")
      .ilike("email", String(userEmail).trim())
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const previousBalance = user.free_credits + user.purchased_credits

    // Calculate new balance
    // Added tales go to purchased_credits: they never expire and survive the monthly plan reset
    let newPurchasedCredits = user.purchased_credits
    let newFreeCredits = user.free_credits
    let adjustmentAmount = 0

    if (adjustmentType === "add") {
      newPurchasedCredits += amount
      adjustmentAmount = amount
    } else if (adjustmentType === "remove") {
      if (amount > previousBalance) {
        return NextResponse.json(
          {
            error: "Insufficient balance",
            currentBalance: previousBalance,
            requestedRemoval: amount,
          },
          { status: 400 },
        )
      }
      // Take from pack/gift tales first, then free/plan tales, so the full amount is removed
      const fromPurchased = Math.min(user.purchased_credits, amount)
      newPurchasedCredits = user.purchased_credits - fromPurchased
      newFreeCredits = user.free_credits - (amount - fromPurchased)
      adjustmentAmount = -amount
    } else if (adjustmentType === "set") {
      // "Set" means the total balance becomes `amount`, as the admin form previews it
      newFreeCredits = Math.min(user.free_credits, amount)
      newPurchasedCredits = amount - newFreeCredits
      adjustmentAmount = amount - previousBalance
    }

    // Update user credits
    const { error: updateError } = await supabase
      .from("users")
      .update({ purchased_credits: newPurchasedCredits, free_credits: newFreeCredits })
      .eq("id", user.id)

    if (updateError) {
      console.error("Update credits error:", updateError)
      return NextResponse.json({ error: "Failed to update credits" }, { status: 500 })
    }

    // Log transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: adjustmentAmount,
        transaction_type: adjustmentType === "add" ? "grant" : "adjustment",
        metadata: {
          reason,
          admin_email: adminEmail || context.adminEmail,
          admin_action: true,
          adjustment_type: adjustmentType,
          previous_balance: previousBalance,
          new_balance: previousBalance + adjustmentAmount,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (transactionError) {
      console.error("Transaction log error:", transactionError)
    }

    // Log admin action
    await logAdminAction(context.userId, "credit_adjust", {
      targetUserId: user.id,
      targetEmail: userEmail,
      adjustmentType,
      amount,
      reason,
      previousBalance,
      newBalance: previousBalance + adjustmentAmount,
    })

    // Log API request
    const duration = Date.now() - startTime
    await logApiRequest({
      userId: context.userId,
      endpoint: "/api/admin/credits/adjust",
      method: "POST",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      statusCode: 200,
      duration,
    })

    const response = NextResponse.json({
      success: true,
      previousBalance,
      newBalance: previousBalance + adjustmentAmount,
      transactionId: transaction?.id,
      message: "Credits adjusted successfully",
    })

    return withSecurityHeaders(response)
  } catch (error) {
    const duration = Date.now() - startTime
    await logApiRequest({
      userId: context.userId,
      endpoint: "/api/admin/credits/adjust",
      method: "POST",
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      statusCode: 500,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    console.error("Adjust credits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withRateLimit(adminRateLimiter, handler)
