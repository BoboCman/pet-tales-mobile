import { createClient } from "@supabase/supabase-js"


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
  pack_type: string | null
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
  /** Which balance the tale came from, so a failed start can be refunded to the same place */
  deductedFrom?: "free" | "purchased"
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
      deductedFrom: result.deducted_from === "purchased" ? "purchased" : "free",
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
  packType: string,
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
    // This row is also the idempotency record, so it must be written. If an old check constraint on
    // pack_type rejects a newer pack id (e.g. try_pack), keep the id in metadata and retry without it.
    const row = {
      user_id: userId,
      amount: amount,
      transaction_type: "purchase",
      stripe_payment_intent_id: stripePaymentIntentId,
      metadata: { pack_type: packType, credits_added: amount },
    }
    let { error: transactionError } = await supabase.from("credit_transactions").insert({ ...row, pack_type: packType })
    if (transactionError) {
      console.warn("[admin] addPurchasedCredits: retrying transaction log without pack_type:", transactionError.message)
      ;({ error: transactionError } = await supabase.from("credit_transactions").insert(row))
    }

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
 * Give back a tale when processing could not start (e.g. the n8n trigger failed).
 * Only for a deduction made moments earlier in the same request. Logged as a "refund".
 */
export async function refundCredit(
  userId: string,
  bucket: "free" | "purchased",
  reason: string,
): Promise<{ error: Error | null }> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase.rpc("refund_credit_atomic", { user_uuid: userId, bucket })
    if (error) {
      console.error("[admin] refundCredit RPC error:", error)
      return { error: new Error(`Failed to refund credit: ${error.message}`) }
    }
    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: 1,
      transaction_type: "refund",
      metadata: { reason, refunded_to: bucket },
    })
    if (txError) console.error("[admin] refundCredit transaction log error:", txError)
    return { error: null }
  } catch (error) {
    console.error("[admin] refundCredit exception:", error)
    return { error: error instanceof Error ? error : new Error("Unknown error") }
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
