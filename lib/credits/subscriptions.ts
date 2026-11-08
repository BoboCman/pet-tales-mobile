import { createClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"
import { getPlanByPriceId } from "@/lib/pricing-config"

/**
 * Subscription credit handling (server/webhook only, uses the service role).
 *
 * Plan tales live in users.free_credits, which deductCredit() spends before purchased_credits.
 * Each paid invoice ADDS the plan's monthly tales to free_credits, capped at two months' worth
 * (unused tales roll over for one month). Pack tales (purchased_credits) are kept and used only
 * after the plan's tales run out.
 * When the subscription ends (canceled/unpaid), free_credits is set to 0. There is no free
 * monthly tale for non-subscribers.
 */

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("[subscriptions] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const ACTIVE_STATUSES = new Set(["active", "trialing"])
/** The subscription is over: Stripe won't charge again */
const ENDED_STATUSES = new Set(["canceled", "unpaid"])

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status)
}

function idOf(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && "id" in (value as any)) return (value as any).id ?? null
  return null
}

/** Find our user for a Stripe subscription: metadata.userId first, then the Stripe customer */
async function findUserId(subscription: any): Promise<string | null> {
  const metaUserId = subscription?.metadata?.userId
  if (metaUserId) return metaUserId

  const customerId = idOf(subscription?.customer)
  if (!customerId) return null

  const supabase = getAdminClient()
  const { data } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle()
  return data?.id ?? null
}

function periodEndIso(subscription: any): string | null {
  // API 2024-12-18 has current_period_end on the subscription; newer versions put it on items.
  const end = subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end
  return typeof end === "number" ? new Date(end * 1000).toISOString() : null
}

/**
 * Save a subscription's state (plan, status, period end) on the user.
 * Called for checkout completion, subscription updates/cancellations and paid invoices.
 */
export async function syncSubscription(
  subscription: any,
): Promise<{ userId: string | null; ignored?: string; error: Error | null }> {
  try {
    // The Stripe account may be shared with other apps: only PetTaleAI plan prices are ours.
    const priceId = subscription?.items?.data?.[0]?.price?.id ?? null
    const plan = getPlanByPriceId(priceId)
    if (!plan) {
      return { userId: null, ignored: `price ${priceId} is not a PetTaleAI plan`, error: null }
    }

    const userId = await findUserId(subscription)
    if (!userId) {
      console.warn(`[subscriptions] No PetTaleAI user for subscription ${subscription?.id}`)
      return { userId: null, ignored: "no matching user", error: null }
    }
    const status: string = subscription?.status ?? "incomplete"
    const active = isActiveSubscriptionStatus(status)

    const supabase = getAdminClient()

    // An event for an older subscription must not overwrite a newer active one
    const { data: current } = await supabase
      .from("users")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", userId)
      .maybeSingle()
    if (
      current?.stripe_subscription_id &&
      current.stripe_subscription_id !== subscription.id &&
      isActiveSubscriptionStatus(current.subscription_status)
    ) {
      return { userId, ignored: `stale event for old subscription ${subscription.id}`, error: null }
    }

    // When the plan has ended, unused plan tales go away (they are a monthly allowance).
    const ended = ENDED_STATUSES.has(status)

    const { error } = await supabase
      .from("users")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        // past_due keeps the plan (Stripe is retrying the card); it ends at canceled/unpaid
        subscription_tier: active || status === "past_due" ? plan.id : "free",
        subscription_status: status,
        subscription_period_end: periodEndIso(subscription),
        subscription_cancel_at_period_end: !!subscription?.cancel_at_period_end,
        ...(ended ? { free_credits: 0 } : {}),
      })
      .eq("id", userId)

    if (error) {
      console.error("[subscriptions] syncSubscription update error:", error)
      return { userId, error: new Error(`Failed to save subscription: ${error.message}`) }
    }

    console.log("[subscriptions] Synced subscription", {
      userId,
      subscriptionId: subscription.id,
      plan: plan?.id ?? null,
      status,
    })
    return { userId, error: null }
  } catch (error) {
    console.error("[subscriptions] syncSubscription exception:", error)
    return { userId: null, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/**
 * Grant a plan's monthly tales for a paid subscription invoice (first payment and each renewal).
 * Idempotent per invoice: "invoice:<id>" is stored in credit_transactions.stripe_payment_intent_id,
 * which has a unique index.
 */
/** Unused plan tales roll over for one month: the balance never goes past two months' worth. */
export const ROLLOVER_MONTHS = 2

export function planTalesAfterRenewal(current: number, talesPerMonth: number): number {
  const cap = talesPerMonth * ROLLOVER_MONTHS
  // Never take tales away at renewal, even if an admin gift put someone above the cap
  return Math.max(current, Math.min(current + talesPerMonth, cap))
}

export async function grantPlanTalesForInvoice(
  invoice: any,
): Promise<{ granted: boolean; duplicate?: boolean; skipped?: string; error: Error | null }> {
  try {
    const billingReason: string | undefined = invoice?.billing_reason
    if (billingReason !== "subscription_create" && billingReason !== "subscription_cycle") {
      return { granted: false, skipped: `billing_reason ${billingReason}`, error: null }
    }

    const subscriptionId =
      idOf(invoice?.subscription) ?? idOf(invoice?.parent?.subscription_details?.subscription) ?? null
    if (!subscriptionId) {
      return { granted: false, skipped: "invoice has no subscription", error: null }
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = (subscription as any)?.items?.data?.[0]?.price?.id ?? null
    const plan = getPlanByPriceId(priceId)
    if (!plan) {
      // Another app's subscription on a shared Stripe account
      return { granted: false, skipped: `price ${priceId} is not a PetTaleAI plan`, error: null }
    }

    const { userId, ignored, error: syncError } = await syncSubscription(subscription)
    if (syncError) {
      return { granted: false, error: syncError }
    }
    if (!userId) {
      return { granted: false, skipped: ignored ?? "no matching user", error: null }
    }

    const supabase = getAdminClient()
    const idempotencyKey = `invoice:${invoice.id}`

    const { data: existing, error: checkError } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("stripe_payment_intent_id", idempotencyKey)
      .limit(1)

    if (checkError) {
      console.error("[subscriptions] duplicate check error:", checkError)
      return { granted: false, error: new Error(`Failed to check for duplicate invoice: ${checkError.message}`) }
    }
    if (existing && existing.length > 0) {
      return { granted: false, duplicate: true, error: null }
    }

    // Add this month's tales; unused ones roll over, capped at two months' worth. Pack tales are untouched.
    const { data: balanceRow, error: balanceError } = await supabase
      .from("users")
      .select("free_credits")
      .eq("id", userId)
      .maybeSingle()
    if (balanceError) {
      return { granted: false, error: new Error(`Failed to read plan tales: ${balanceError.message}`) }
    }
    const before = Math.max(0, Number(balanceRow?.free_credits) || 0)
    const after = planTalesAfterRenewal(before, plan.talesPerMonth)

    const { error: updateError } = await supabase.from("users").update({ free_credits: after }).eq("id", userId)

    if (updateError) {
      console.error("[subscriptions] grant update error:", updateError)
      return { granted: false, error: new Error(`Failed to grant plan tales: ${updateError.message}`) }
    }

    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: after - before,
      transaction_type: "grant",
      pack_type: null,
      stripe_payment_intent_id: idempotencyKey,
      metadata: {
        subscription: true,
        plan_id: plan.id,
        invoice_id: invoice.id,
        billing_reason: billingReason,
        subscription_id: subscriptionId,
        monthly_tales: plan.talesPerMonth,
        balance_before: before,
        balance_after: after,
      },
    })
    if (txError) {
      // Logged but not fatal: the tales are granted. Without this row a Stripe retry could add the
      // month again, which the two-month cap keeps small.
      console.error("[subscriptions] transaction log error:", txError)
    }

    console.log("[subscriptions] Granted plan tales", {
      userId,
      plan: plan.id,
      tales: plan.talesPerMonth,
      before,
      after,
      invoice: invoice.id,
      billingReason,
    })
    return { granted: true, error: null }
  } catch (error) {
    console.error("[subscriptions] grantPlanTalesForInvoice exception:", error)
    return { granted: false, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}
