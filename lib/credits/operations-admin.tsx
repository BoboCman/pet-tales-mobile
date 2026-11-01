import { createClient } from "@supabase/supabase-js"

// Export all interfaces from operations-server for type consistency
export type {
  CreditBalance,
  CreditTransaction,
  DeductCreditResult,
  GrantCreditResult,
  AddCreditsResult,
} from "./operations-server"

/**
 * Get admin Supabase client with service role key
 * SECURITY: Bypasses Row Level Security - use only in privileged contexts
 * @returns Supabase client with full database access
 */
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "[admin] Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Credit balance information for a user
 */
export interface CreditBalance {
  purchased_credits: number
  free_credits: number
  total: number
  welcome_granted: boolean
  last_weekly_date: string | null
}

/**
 * Credit transaction record
 */
export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: "welcome" | "weekly" | "purchase" | "deduction"
  pack_type: "quick_fix" | "party_pack" | "creator_bundle" | null
  stripe_payment_intent_id: string | null
  metadata: Record<string, any>
  created_at: string
}

/**
 * Result of a credit deduction operation
 */
export interface DeductCreditResult {
  data: CreditBalance | null
  error: Error | null
}

/**
 * Result of a credit grant operation
 */
export interface GrantCreditResult {
  data: (CreditBalance & { days_until_next?: number }) | null
  error: Error | null
  already_granted?: boolean
}

/**
 * Result of adding purchased credits
 */
export interface AddCreditsResult {
  data: CreditBalance | null
  error: Error | null
  duplicate?: boolean
}

/**
 * Get the current credit balance for a user
 *
 * @param userId - The user's UUID
 * @returns Promise with credit balance data or error
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await getUserCredits(userId);
 * if (result.error) {
 *   console.error("Failed to get credits:", result.error);
 * } else {
 *   console.log(`Total credits: ${result.data.total}`);
 * }
 */
export async function getUserCredits(userId: string): Promise<{ data: CreditBalance | null; error: Error | null }> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("users")
      .select("purchased_credits, free_credits, welcome_credits_granted, last_weekly_credit_date")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[admin] getUserCredits error:", error)
      return { data: null, error: new Error(`Failed to fetch user credits: ${error.message}`) }
    }

    if (!data) {
      return { data: null, error: new Error("User not found") }
    }

    const balance: CreditBalance = {
      purchased_credits: data.purchased_credits ?? 0,
      free_credits: data.free_credits ?? 0,
      total: (data.purchased_credits ?? 0) + (data.free_credits ?? 0),
      welcome_granted: data.welcome_credits_granted ?? false,
      last_weekly_date: data.last_weekly_credit_date,
    }

    return { data: balance, error: null }
  } catch (error) {
    console.error("[admin] getUserCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Deduct one credit from a user's balance
 * Uses atomic PostgreSQL function with row-level locking to prevent race conditions
 * Deducts from free_credits first, then purchased_credits
 *
 * @param userId - The user's UUID
 * @returns Promise with updated credit balance or error
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await deductCredit(userId);
 * if (result.error) {
 *   toast.error("Insufficient credits");
 * } else {
 *   console.log(`Credits remaining: ${result.data.total}`);
 * }
 */
export async function deductCredit(userId: string): Promise<DeductCreditResult> {
  try {
    const supabase = getAdminClient()

    console.log("[admin] Attempting atomic credit deduction for user:", userId)

    const { data, error } = await supabase.rpc("deduct_credit_atomic", {
      user_uuid: userId,
    })

    if (error) {
      console.error("[admin] deductCredit RPC error:", error)
      return {
        data: null,
        error: new Error(`Failed to deduct credit: ${error.message}`),
      }
    }

    if (!data || data.length === 0) {
      console.error("[admin] deductCredit no data returned")
      return {
        data: null,
        error: new Error("No data returned from credit deduction"),
      }
    }

    const result = data[0]

    if (!result.success) {
      console.log("[admin] Insufficient credits for user:", userId)
      return {
        data: null,
        error: new Error("Insufficient credits"),
      }
    }

    console.log("[admin] Credit deducted successfully:", {
      userId,
      deductedFrom: result.deducted_from,
      totalRemaining: result.total_remaining,
    })

    // Log transaction for audit trail
    try {
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: -1,
        transaction_type: "deduction",
        metadata: {
          deducted_from: result.deducted_from,
          remaining_after: result.total_remaining,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (logError) {
      console.error("[admin] Failed to log transaction:", logError)
    }

    // Fetch additional user data for compatibility
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("welcome_credits_granted, last_weekly_credit_date")
      .eq("id", userId)
      .single()

    if (userError) {
      console.warn("[admin] Failed to fetch user metadata:", userError)
    }

    return {
      data: {
        free_credits: result.new_free_credits,
        purchased_credits: result.new_purchased_credits,
        total: result.total_remaining,
        welcome_granted: userData?.welcome_credits_granted ?? true,
        last_weekly_date: userData?.last_weekly_credit_date ?? null,
      },
      error: null,
    }
  } catch (error) {
    console.error("[admin] deductCredit exception:", error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    }
  }
}

/**
 * Add purchased credits to a user's balance
 * Includes idempotency check via Stripe payment intent ID
 *
 * @param userId - The user's UUID
 * @param amount - Number of credits to add
 * @param packType - Type of pack purchased
 * @param stripePaymentIntentId - Stripe payment intent ID for idempotency
 * @returns Promise with updated credit balance or error
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await addPurchasedCredits(
 *   userId,
 *   10,
 *   'party_pack',
 *   'pi_1234567890'
 * );
 * if (result.duplicate) {
 *   console.log("Credits already added for this payment");
 * }
 */
export async function addPurchasedCredits(
  userId: string,
  amount: number,
  packType: "quick_fix" | "party_pack" | "creator_bundle",
  stripePaymentIntentId: string,
): Promise<AddCreditsResult> {
  try {
    const supabase = getAdminClient()

    // CRITICAL: Check for duplicate payment intent (idempotency)
    const { data: existingTransaction, error: checkError } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("stripe_payment_intent_id", stripePaymentIntentId)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is expected for new payments
      console.error("[admin] addPurchasedCredits duplicate check error:", checkError)
      return { data: null, error: new Error(`Failed to check for duplicate payment: ${checkError.message}`) }
    }

    if (existingTransaction) {
      // Payment already processed, return current balance without adding credits again
      console.log("[admin] Duplicate payment intent detected:", stripePaymentIntentId)
      const { data: balance, error: balanceError } = await getUserCredits(userId)
      return { data: balance, error: balanceError, duplicate: true }
    }

    // Get current credits
    const { data: currentBalance, error: balanceError } = await getUserCredits(userId)
    if (balanceError || !currentBalance) {
      return { data: null, error: balanceError || new Error("Failed to get current balance") }
    }

    // Add to purchased_credits
    const newPurchasedCredits = currentBalance.purchased_credits + amount

    const { error: updateError } = await supabase
      .from("users")
      .update({ purchased_credits: newPurchasedCredits })
      .eq("id", userId)

    if (updateError) {
      console.error("[admin] addPurchasedCredits update error:", updateError)
      return { data: null, error: new Error(`Failed to add credits: ${updateError.message}`) }
    }

    // Log transaction with payment intent ID
    const { error: transactionError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: amount,
      transaction_type: "purchase",
      pack_type: packType,
      stripe_payment_intent_id: stripePaymentIntentId,
      metadata: { pack_type: packType, credits_added: amount },
    })

    if (transactionError) {
      console.error("[admin] addPurchasedCredits transaction log error:", transactionError)
      // Don't fail the operation if logging fails
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: newBalance, error: null, duplicate: false }
  } catch (error) {
    console.error("[admin] addPurchasedCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Grant welcome credits to a new user (one-time, idempotent)
 *
 * @param userId - The user's UUID
 * @returns Promise with credit balance or error
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await grantWelcomeCredits(userId);
 * if (result.already_granted) {
 *   console.log("Welcome credits already granted");
 * }
 */
export async function grantWelcomeCredits(userId: string): Promise<GrantCreditResult> {
  try {
    const supabase = getAdminClient()

    // Check if welcome credits already granted
    const { data: currentBalance, error: balanceError } = await getUserCredits(userId)
    if (balanceError || !currentBalance) {
      return { data: null, error: balanceError || new Error("Failed to get current balance") }
    }

    if (currentBalance.welcome_granted) {
      // Already granted, return success without granting again (idempotent)
      return { data: currentBalance, error: null, already_granted: true }
    }

    // Grant 3 welcome credits
    const { error: updateError } = await supabase
      .from("users")
      .update({
        free_credits: 3,
        welcome_credits_granted: true,
      })
      .eq("id", userId)

    if (updateError) {
      console.error("[admin] grantWelcomeCredits update error:", updateError)
      return { data: null, error: new Error(`Failed to grant welcome credits: ${updateError.message}`) }
    }

    // Log transaction
    const { error: transactionError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: 3,
      transaction_type: "welcome",
      metadata: { welcome_bonus: true },
    })

    if (transactionError) {
      console.error("[admin] grantWelcomeCredits transaction log error:", transactionError)
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: newBalance, error: null, already_granted: false }
  } catch (error) {
    console.error("[admin] grantWelcomeCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Grant weekly free credit to a user (recurring, once per 7 days)
 *
 * @param userId - The user's UUID
 * @returns Promise with credit balance and days until next credit
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await grantWeeklyCredit(userId);
 * if (result.data?.days_until_next) {
 *   console.log(`Next free credit in ${result.data.days_until_next} days`);
 * }
 */
export async function grantWeeklyCredit(userId: string): Promise<GrantCreditResult> {
  try {
    const supabase = getAdminClient()

    // Get current credits and last weekly date
    const { data: currentBalance, error: balanceError } = await getUserCredits(userId)
    if (balanceError || !currentBalance) {
      return { data: null, error: balanceError || new Error("Failed to get current balance") }
    }

    // ============================================================
    // SAFEGUARD: Check transaction history directly
    // This prevents duplicate grants even if last_weekly_credit_date is null
    // ============================================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentWeeklyTransaction, error: txCheckError } = await supabase
      .from("credit_transactions")
      .select("created_at")
      .eq("user_id", userId)
      .eq("transaction_type", "weekly")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(1)

    if (txCheckError) {
      console.error("[admin] grantWeeklyCredit transaction check error:", txCheckError)
      // Continue with date-based check as fallback
    }

    if (recentWeeklyTransaction && recentWeeklyTransaction.length > 0) {
      // User already received a weekly credit within the last 7 days
      const lastTxDate = new Date(recentWeeklyTransaction[0].created_at)
      const daysSinceTx = (Date.now() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)
      const daysUntilNext = Math.ceil(7 - daysSinceTx)

      console.log(
        `[admin] User ${userId} already received weekly credit ${daysSinceTx.toFixed(1)} days ago (via transaction check)`,
      )

      return {
        data: { ...currentBalance, days_until_next: daysUntilNext },
        error: null,
        already_granted: true,
      }
    }
    // </CHANGE>

    const now = new Date()
    const lastWeeklyDate = currentBalance.last_weekly_date ? new Date(currentBalance.last_weekly_date) : null

    // Calculate days since last weekly credit
    let daysSinceLastCredit = Number.POSITIVE_INFINITY
    if (lastWeeklyDate) {
      const diffMs = now.getTime() - lastWeeklyDate.getTime()
      daysSinceLastCredit = diffMs / (1000 * 60 * 60 * 24)
    }

    // Check if 7 days have passed
    if (lastWeeklyDate && daysSinceLastCredit < 7) {
      // Not eligible yet
      const daysUntilNext = Math.ceil(7 - daysSinceLastCredit)
      return {
        data: { ...currentBalance, days_until_next: daysUntilNext },
        error: null,
        already_granted: true,
      }
    }

    // Grant 1 weekly credit
    const newFreeCredits = currentBalance.free_credits + 1

    const { error: updateError } = await supabase
      .from("users")
      .update({
        free_credits: newFreeCredits,
        last_weekly_credit_date: now.toISOString(),
      })
      .eq("id", userId)

    if (updateError) {
      console.error("[admin] grantWeeklyCredit update error:", updateError)
      return { data: null, error: new Error(`Failed to grant weekly credit: ${updateError.message}`) }
    }

    // Log transaction
    const { error: transactionError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: 1,
      transaction_type: "weekly",
      metadata: { weekly_bonus: true, previous_date: lastWeeklyDate?.toISOString() },
    })

    if (transactionError) {
      console.error("[admin] grantWeeklyCredit transaction log error:", transactionError)
    }

    console.log(`[admin] ✓ Granted weekly credit to user ${userId}`, {
      previousLastWeeklyDate: lastWeeklyDate?.toISOString() ?? "NULL",
      newLastWeeklyDate: now.toISOString(),
      previousFreeCredits: currentBalance.free_credits,
      newFreeCredits: newFreeCredits,
    })
    // </CHANGE>

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: { ...newBalance, days_until_next: 7 }, error: null, already_granted: false }
  } catch (error) {
    console.error("[admin] grantWeeklyCredit exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Get credit transaction history for a user
 *
 * @param userId - The user's UUID
 * @param limit - Maximum number of transactions to return (default: 50)
 * @returns Promise with transaction history or error
 * @security Uses service role - bypasses RLS. For admin/webhook use only.
 *
 * @example
 * const result = await getCreditTransactionHistory(userId, 20);
 * if (result.data) {
 *   result.data.forEach(tx => {
 *     console.log(`${tx.transaction_type}: ${tx.amount} credits`);
 *   });
 * }
 */
export async function getCreditTransactionHistory(
  userId: string,
  limit = 50,
): Promise<{ data: CreditTransaction[] | null; error: Error | null }> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[admin] getCreditTransactionHistory error:", error)
      return { data: null, error: new Error(`Failed to fetch transaction history: ${error.message}`) }
    }

    return { data: data as CreditTransaction[], error: null }
  } catch (error) {
    console.error("[admin] getCreditTransactionHistory exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}
