import { createClient } from "@/lib/supabase/server"

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
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("users")
      .select("purchased_credits, free_credits, welcome_credits_granted, last_weekly_credit_date")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[v0] getUserCredits error:", error)
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
    console.error("[v0] getUserCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Deduct one credit from a user's balance
 * Deducts from free_credits first, then purchased_credits
 *
 * @param userId - The user's UUID
 * @returns Promise with updated credit balance or error
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
    const supabase = await createClient()

    // Get current credits
    const { data: currentBalance, error: balanceError } = await getUserCredits(userId)
    if (balanceError || !currentBalance) {
      return { data: null, error: balanceError || new Error("Failed to get current balance") }
    }

    // Check if user has any credits
    if (currentBalance.total === 0) {
      return { data: null, error: new Error("Insufficient credits") }
    }

    // Determine which credit type to deduct from
    let updateData: { free_credits?: number; purchased_credits?: number }
    let deductedFrom: "free" | "purchased"

    if (currentBalance.free_credits > 0) {
      // Deduct from free credits first
      updateData = { free_credits: currentBalance.free_credits - 1 }
      deductedFrom = "free"
    } else {
      // Deduct from purchased credits
      updateData = { purchased_credits: currentBalance.purchased_credits - 1 }
      deductedFrom = "purchased"
    }

    // Update user credits
    const { error: updateError } = await supabase.from("users").update(updateData).eq("id", userId)

    if (updateError) {
      console.error("[v0] deductCredit update error:", updateError)
      return { data: null, error: new Error(`Failed to deduct credit: ${updateError.message}`) }
    }

    // Log transaction
    const { error: transactionError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: -1,
      transaction_type: "deduction",
      metadata: { deducted_from: deductedFrom },
    })

    if (transactionError) {
      console.error("[v0] deductCredit transaction log error:", transactionError)
      // Don't fail the operation if logging fails, but log the error
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: newBalance, error: null }
  } catch (error) {
    console.error("[v0] deductCredit exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
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
    const supabase = await createClient()

    // CRITICAL: Check for duplicate payment intent (idempotency)
    const { data: existingTransaction, error: checkError } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("stripe_payment_intent_id", stripePaymentIntentId)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is expected for new payments
      console.error("[v0] addPurchasedCredits duplicate check error:", checkError)
      return { data: null, error: new Error(`Failed to check for duplicate payment: ${checkError.message}`) }
    }

    if (existingTransaction) {
      // Payment already processed, return current balance without adding credits again
      console.log("[v0] Duplicate payment intent detected:", stripePaymentIntentId)
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
      console.error("[v0] addPurchasedCredits update error:", updateError)
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
      console.error("[v0] addPurchasedCredits transaction log error:", transactionError)
      // Don't fail the operation if logging fails
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: newBalance, error: null, duplicate: false }
  } catch (error) {
    console.error("[v0] addPurchasedCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Grant welcome credits to a new user (one-time, idempotent)
 *
 * @param userId - The user's UUID
 * @returns Promise with credit balance or error
 *
 * @example
 * const result = await grantWelcomeCredits(userId);
 * if (result.already_granted) {
 *   console.log("Welcome credits already granted");
 * }
 */
export async function grantWelcomeCredits(userId: string): Promise<GrantCreditResult> {
  try {
    const supabase = await createClient()

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
      console.error("[v0] grantWelcomeCredits update error:", updateError)
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
      console.error("[v0] grantWelcomeCredits transaction log error:", transactionError)
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: newBalance, error: null, already_granted: false }
  } catch (error) {
    console.error("[v0] grantWelcomeCredits exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Grant weekly free credit to a user (recurring, once per 7 days)
 *
 * @param userId - The user's UUID
 * @returns Promise with credit balance and days until next credit
 *
 * @example
 * const result = await grantWeeklyCredit(userId);
 * if (result.data?.days_until_next) {
 *   console.log(`Next free credit in ${result.data.days_until_next} days`);
 * }
 */
export async function grantWeeklyCredit(userId: string): Promise<GrantCreditResult> {
  try {
    const supabase = await createClient()

    // Get current credits and last weekly date
    const { data: currentBalance, error: balanceError } = await getUserCredits(userId)
    if (balanceError || !currentBalance) {
      return { data: null, error: balanceError || new Error("Failed to get current balance") }
    }

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
      console.error("[v0] grantWeeklyCredit update error:", updateError)
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
      console.error("[v0] grantWeeklyCredit transaction log error:", transactionError)
    }

    // Get updated balance
    const { data: newBalance, error: newBalanceError } = await getUserCredits(userId)
    if (newBalanceError) {
      return { data: null, error: newBalanceError }
    }

    return { data: { ...newBalance, days_until_next: 7 }, error: null, already_granted: false }
  } catch (error) {
    console.error("[v0] grantWeeklyCredit exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Get credit transaction history for a user
 *
 * @param userId - The user's UUID
 * @param limit - Maximum number of transactions to return (default: 50)
 * @returns Promise with transaction history or error
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
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[v0] getCreditTransactionHistory error:", error)
      return { data: null, error: new Error(`Failed to fetch transaction history: ${error.message}`) }
    }

    return { data: data as CreditTransaction[], error: null }
  } catch (error) {
    console.error("[v0] getCreditTransactionHistory exception:", error)
    return { data: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}
