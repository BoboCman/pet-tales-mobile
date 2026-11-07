import { createClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"

/**
 * Remove tales when Stripe money goes back to the customer (server/webhook only).
 *
 * - charge.refunded: a refund issued from the Stripe dashboard (or the API).
 * - charge.dispute.created: a chargeback. Treated like a full refund.
 *
 * Packs: the refunded share of the pack's tales is removed from purchased_credits (never below 0;
 * tales already used stay used). Plans: a full refund or a dispute of the most recent plan payment
 * sets this month's plan tales (free_credits) to 0. A partial plan refund is treated as goodwill and
 * changes nothing. Refunding a plan does NOT cancel it in Stripe: cancel the subscription too.
 *
 * Only payments this app recorded are touched, so another app's charges are ignored. Each refund
 * amount / dispute is applied once, keyed in credit_transactions.stripe_payment_intent_id.
 */

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("[refunds] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function idOf(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && "id" in (value as any)) return (value as any).id ?? null
  return null
}

export interface ReversalResult {
  applied: boolean
  skipped?: string
  duplicate?: boolean
  talesRemoved?: number
  error: Error | null
}

type Reason = "stripe_refund" | "stripe_dispute"

/** Log the reversal first: the unique key makes Stripe retries a no-op */
async function logReversal(
  supabase: ReturnType<typeof getAdminClient>,
  row: { user_id: string; amount: number; key: string; metadata: Record<string, unknown> },
): Promise<"ok" | "duplicate" | Error> {
  const { error } = await supabase.from("credit_transactions").insert({
    user_id: row.user_id,
    amount: row.amount,
    transaction_type: "adjustment",
    pack_type: null,
    stripe_payment_intent_id: row.key,
    metadata: row.metadata,
  })
  if (!error) return "ok"
  if (error.code === "23505") return "duplicate"
  return new Error(`Failed to log reversal: ${error.message}`)
}

async function reverseCharge(charge: any, reason: Reason, key: string): Promise<ReversalResult> {
  try {
    const supabase = getAdminClient()
    const paymentIntentId = idOf(charge?.payment_intent)
    const chargeId: string = charge?.id
    const fullReversal = reason === "stripe_dispute" || charge?.refunded === true
    const fraction =
      reason === "stripe_dispute" ? 1 : charge?.amount ? Math.min(1, (charge.amount_refunded ?? 0) / charge.amount) : 0

    // 1) Pack purchase?
    if (paymentIntentId) {
      const { data: purchase } = await supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("transaction_type", "purchase")
        .maybeSingle()

      if (purchase) {
        const packTales = Number(purchase.amount) || 0
        const target = fullReversal ? packTales : Math.round(fraction * packTales)

        // Earlier partial refunds of the same payment already took some tales back
        const { data: earlier } = await supabase
          .from("credit_transactions")
          .select("metadata")
          .eq("transaction_type", "adjustment")
          .eq("metadata->>source_payment", paymentIntentId)
        const alreadyReversed = (earlier ?? []).reduce(
          (sum: number, row: any) => sum + (Number(row.metadata?.tales_reversed) || 0),
          0,
        )
        const toReverse = Math.max(0, target - alreadyReversed)
        if (toReverse === 0) {
          return { applied: false, skipped: "nothing left to reverse for this pack", error: null }
        }

        const { data: user } = await supabase
          .from("users")
          .select("purchased_credits")
          .eq("id", purchase.user_id)
          .single()
        const current = Number(user?.purchased_credits) || 0
        const removed = Math.min(current, toReverse)

        const logged = await logReversal(supabase, {
          user_id: purchase.user_id,
          amount: -removed,
          key,
          metadata: {
            reason,
            kind: "pack",
            source_payment: paymentIntentId,
            charge_id: chargeId,
            tales_reversed: toReverse,
            tales_removed: removed,
            already_used: toReverse - removed,
          },
        })
        if (logged === "duplicate") return { applied: false, duplicate: true, error: null }
        if (logged instanceof Error) return { applied: false, error: logged }

        if (removed > 0) {
          const { error } = await supabase
            .from("users")
            .update({ purchased_credits: current - removed })
            .eq("id", purchase.user_id)
          if (error) return { applied: false, error: new Error(`Failed to remove pack tales: ${error.message}`) }
        }

        console.log("[refunds] Pack tales reversed", { userId: purchase.user_id, removed, toReverse, reason })
        return { applied: true, talesRemoved: removed, error: null }
      }
    }

    // 2) Plan payment?
    const invoiceId = idOf(charge?.invoice)
    if (invoiceId) {
      const invoiceKey = `invoice:${invoiceId}`
      const { data: grant } = await supabase
        .from("credit_transactions")
        .select("user_id, amount")
        .eq("stripe_payment_intent_id", invoiceKey)
        .maybeSingle()

      if (!grant) return { applied: false, skipped: "invoice is not a PetTaleAI plan payment", error: null }
      if (!fullReversal) return { applied: false, skipped: "partial plan refund: tales kept", error: null }

      // Only the latest paid month can be taken back; an older invoice's tales were already reset
      const { data: latest } = await supabase
        .from("credit_transactions")
        .select("stripe_payment_intent_id")
        .eq("user_id", grant.user_id)
        .eq("transaction_type", "grant")
        .like("stripe_payment_intent_id", "invoice:%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latest?.stripe_payment_intent_id !== invoiceKey) {
        return { applied: false, skipped: "refunded invoice is not the current month", error: null }
      }

      const { data: user } = await supabase.from("users").select("free_credits").eq("id", grant.user_id).single()
      const current = Number(user?.free_credits) || 0

      const logged = await logReversal(supabase, {
        user_id: grant.user_id,
        amount: -current,
        key,
        metadata: { reason, kind: "plan", invoice_id: invoiceId, charge_id: chargeId, tales_removed: current },
      })
      if (logged === "duplicate") return { applied: false, duplicate: true, error: null }
      if (logged instanceof Error) return { applied: false, error: logged }

      if (current > 0) {
        const { error } = await supabase.from("users").update({ free_credits: 0 }).eq("id", grant.user_id)
        if (error) return { applied: false, error: new Error(`Failed to remove plan tales: ${error.message}`) }
      }

      console.log("[refunds] Plan tales reversed", { userId: grant.user_id, removed: current, reason })
      return { applied: true, talesRemoved: current, error: null }
    }

    return { applied: false, skipped: "charge is not a PetTaleAI payment", error: null }
  } catch (error) {
    console.error("[refunds] reverseCharge exception:", error)
    return { applied: false, error: error instanceof Error ? error : new Error("Unknown error") }
  }
}

/** charge.refunded */
export async function handleChargeRefunded(charge: any): Promise<ReversalResult> {
  return reverseCharge(charge, "stripe_refund", `refund:${charge.id}:${charge.amount_refunded ?? 0}`)
}

/** charge.dispute.created */
export async function handleDisputeCreated(dispute: any): Promise<ReversalResult> {
  const chargeId = idOf(dispute?.charge)
  if (!chargeId) return { applied: false, skipped: "dispute has no charge", error: null }
  const charge = await stripe.charges.retrieve(chargeId)
  return reverseCharge(charge, "stripe_dispute", `dispute:${dispute.id}`)
}
