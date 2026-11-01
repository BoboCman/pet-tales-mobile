"use server"

import { createClient } from "@/lib/supabase/server"

export interface CreditBalanceResponse {
  ok: boolean
  balance: number
  code?: string
  message?: string
}

export async function getCreditBalance(): Promise<CreditBalanceResponse> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log("Credits API: Authentication required", { authError })
      return {
        ok: false,
        balance: 0,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      }
    }

    // Old system used credits_remaining from subscription model
    // New system uses free_credits (welcome + weekly) + purchased_credits (packs)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("free_credits, purchased_credits")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      console.error("Credits API: Error fetching user data", {
        userId: user.id,
        error: userError,
      })

      // Log error for observability
      console.log("credits_api_error", {
        user_id: user.id,
        error: userError?.message || "Unknown error",
      })

      return {
        ok: false,
        balance: 0,
        code: "SERVER_ERROR",
        message: "Unable to fetch credits",
      }
    }

    // Calculate total credits (free + purchased)
    const freeCredits = userData.free_credits ?? 0
    const purchasedCredits = userData.purchased_credits ?? 0
    const totalBalance = freeCredits + purchasedCredits

    // Log successful fetch with breakdown
    console.log("credits_api_fetch", {
      user_id: user.id,
      free_credits: freeCredits,
      purchased_credits: purchasedCredits,
      balance: totalBalance,
      ok: true,
    })

    return {
      ok: true,
      balance: totalBalance,
    }
  } catch (error) {
    console.error("Credits API: Unexpected error", error)

    // Log error for observability
    console.log("credits_api_error", {
      user_id: "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return {
      ok: false,
      balance: 0,
      code: "SERVER_ERROR",
      message: "Unable to fetch credits",
    }
  }
}
