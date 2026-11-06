import { createClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"
import { getPlanByPriceId } from "@/lib/pricing-config"

/**
 * Subscription credit handling (server/webhook only, uses the service role).
 *
 * Plan tales live in users.free_credits, which deductCredit() spends before purchased_credits.
 * Each paid invoice RESETS free_credits to the plan's monthly tales (no rollover), so pack
 * tales (purchased_credits) are kept and used only after the plan's tales run out.
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
export async function syncSubscription(subscription: any): Promise<{ userId: string | null; error: Error | null }> {
  try {
    const userId = await findUserId(subscription)
    if (!userId) {
      return { userId: null, error: new Error(`No user found for subscription ${subscription?.id}`) }
    }

    const priceId = subscription?.items?.data?.[0]?.price?.id ?? null
    const plan = getPlanByPriceId(priceId)
    const status: string = subscription?.status ?? "incomplete"
    const active = isActiveSubscriptionStatus(status)

    const supabase = getAdminClient()
    const { error } = await supabase
      .from("users")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        subscription_tier: active && plan ? plan.id : "free",
        subscription_status: status,
        subscription_period_end: periodEndIso(subscription),
        subscription_cancel_at_period_end: !!subscription?.cancel_at_period_end,
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
 * Idempotent per invoice: the invoice ID is stored in credit_transactions.stripe_payment_intent_id.
 */
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
    const { userId, error: syncError } = await syncSubscription(subscription)
    if (!userId) {
      return { granted: false, error: syncError ?? new Error("No user for subscription") }
    }

    const priceId = (subscription as any)?.items?.data?.[0]?.price?.id ?? null
    const plan = getPlanByPriceId(priceId)
    if (!plan) {
      return { granted: false, error: new Error(`Price ${priceId} is not a known plan`) }
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

    // Reset plan tales to this month's allowance (no rollover). Pack tales are untouched.
    const { error: updateError } = await supabase
      .from("users")
      .update({ free_credits: plan.talesPerMonth })
      .eq("id", userId)

    if (updateError) {
      console.error("[subscriptions] grant update error:", updateError)
      return { granted: false, error: new Error(`Failed to grant plan tales: ${updateError.message}`) }
    }

    const { error: txError } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: plan.talesPerMonth,
      transaction_type: "purchase",
      pack_type: null,
      stripe_payment_intent_id: idempotencyKey,
      metadata: {
        subscription: true,
        plan_id: plan.id,
        invoice_id: invoice.id,
        billing_reason: billingReason,
        subscription_id: subscriptionId,
      },
    })
    if (txError) {
      // Logged but not fatal: the tales are granted. Without this row a Stripe retry could re-grant,
      // which only resets to the same allowance again.
      console.error("[subscriptions] transaction log error:", txError)
    }

    console.log("[subscriptions] Granted plan tales", {
      userId,
      plan: plan.id,
      tales: plan.talesPerMonth,
      invoice: invoice.id,
      billingReason,
    })
    return { granted: true, error: null }
  } catch (error) {
    console.error("[subscriptions] grantPlanTalesForInvoice exception:", error)
    return { granted: false, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}
