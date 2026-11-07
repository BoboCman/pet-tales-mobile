"use server"

import { createClient } from "@/lib/supabase/server"
import { type PreflightCheckResult, CREDIT_MESSAGES } from "@/lib/types/credit-types"

export async function preflightBalanceCheck(): Promise<PreflightCheckResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("Preflight check: Authentication required", { authError })
      return {
        ok: false,
        balance: 0,
        code: "AUTH_REQUIRED",
        message: CREDIT_MESSAGES.AUTH_REQUIRED,
      }
    }

    // Balance = free/plan tales + pack tales
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("free_credits, purchased_credits")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      console.error("Preflight check: Error fetching user data", {
        userId: user.id,
        error: userError,
      })
      return {
        ok: false,
        balance: 0,
        code: "SERVER_ERROR",
        message: CREDIT_MESSAGES.SERVER_ERROR,
      }
    }

    const freeCredits = userData.free_credits ?? 0
    const purchasedCredits = userData.purchased_credits ?? 0
    const userBalance = freeCredits + purchasedCredits

    // Log the preflight decision
    console.log("Preflight check result", {
      route: "preflight_create",
      user_id: user.id,
      free_credits: freeCredits,
      purchased_credits: purchasedCredits,
      total_balance: userBalance,
      outcome: userBalance >= 1 ? "allowed" : "blocked",
    })

    if (userBalance < 1) {
      return {
        ok: false,
        balance: userBalance,
        code: "OUT_OF_CREDITS",
        message: CREDIT_MESSAGES.OUT_OF_CREDITS,
      }
    }

    return {
      ok: true,
      balance: userBalance,
    }
  } catch (error) {
    console.error("Preflight check: Unexpected error", error)
    return {
      ok: false,
      balance: 0,
      code: "SERVER_ERROR",
      message: CREDIT_MESSAGES.UNEXPECTED_ERROR,
    }
  }
}
