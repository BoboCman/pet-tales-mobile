import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { addPurchasedCredits } from "@/lib/credits/operations-admin"
import { getPackById } from "@/lib/stripe/pack-config"
import { grantPlanTalesForInvoice, syncSubscription } from "@/lib/credits/subscriptions"
import { handleChargeRefunded, handleDisputeCreated } from "@/lib/credits/refunds"

/**
 * STRIPE WEBHOOK HANDLER
 *
 * Plans (checkout, invoice.paid, subscription updates), pack purchases, refunds and chargebacks.
 * Includes signature verification, idempotency protection, and comprehensive logging.
 *
 * Security: ALWAYS verifies webhook signature to prevent fake webhook attacks
 * Idempotency: Uses payment_intent_id to prevent duplicate credit grants
 */

interface CheckoutSession {
  id: string
  payment_intent: string | { id: string }
  customer: string
  amount_total: number
  metadata: {
    userId: string
    pack_id: string
    pack_credits: string
  }
}

/**
 * POST handler for Stripe webhook events
 */
export async function POST(request: NextRequest) {
  console.log("[Webhook] 🔔 Stripe webhook received")

  try {
    // STEP 1: Get raw body for signature verification (CRITICAL)
    const rawBody = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      console.error("[Webhook] ❌ No signature header found")
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
    }

    // STEP 2: Verify webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("[Webhook] ❌ STRIPE_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    // STEP 3: Verify webhook signature (CRITICAL FOR SECURITY)
    let event
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      console.log("[Webhook] ✅ Signature verified successfully")
    } catch (err) {
      const error = err as Error
      console.error("[Webhook] ❌ Signature verification failed:", error.message)
      return NextResponse.json({ error: `Webhook signature verification failed: ${error.message}` }, { status: 400 })
    }

    console.log("[Webhook] 📦 Event received:", {
      type: event.type,
      id: event.id,
    })

    // STEP 4: Subscription events (plans). Pack purchases continue below.
    const eventObject = event.data.object as any

    if (event.type === "checkout.session.completed" && eventObject.mode === "subscription") {
      const subscriptionId =
        typeof eventObject.subscription === "string" ? eventObject.subscription : eventObject.subscription?.id
      if (!subscriptionId) {
        console.error("[Webhook] ❌ Subscription checkout without a subscription ID:", eventObject.id)
        return NextResponse.json({ error: "Missing subscription" }, { status: 400 })
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const { error } = await syncSubscription(subscription)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      // Tales are granted by invoice.paid, which Stripe sends for the first payment too.
      return NextResponse.json({ received: true, subscription_synced: true })
    }

    if (event.type === "invoice.paid") {
      const result = await grantPlanTalesForInvoice(eventObject)
      if (result.error) {
        console.error("[Webhook] ❌ Failed to grant plan tales:", result.error)
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
      return NextResponse.json({ received: true, ...result, error: undefined })
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const { error } = await syncSubscription(eventObject)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ received: true, subscription_synced: true })
    }

    // Refunds and chargebacks take the paid tales back
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const result =
        event.type === "charge.refunded"
          ? await handleChargeRefunded(eventObject)
          : await handleDisputeCreated(eventObject)
      if (result.error) {
        console.error("[Webhook] ❌ Failed to reverse tales:", result.error)
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
      return NextResponse.json({ received: true, ...result, error: undefined })
    }

    // STEP 4b: Everything else except pack checkouts is ignored
    if (event.type !== "checkout.session.completed") {
      console.log("[Webhook] ℹ️ Ignoring event type:", event.type)
      return NextResponse.json({ received: true })
    }

    // STEP 5: Extract session data
    const session = event.data.object as CheckoutSession

    console.log("[Webhook] 📋 Session data:", {
      sessionId: session.id,
      paymentIntent: session.payment_intent,
      customer: session.customer,
      amount: session.amount_total,
      metadata: session.metadata,
    })

    // STEP 6: Validate required metadata
    const { userId, pack_id, pack_credits } = session.metadata

    if (!userId || !pack_id || !pack_credits) {
      console.error("[Webhook] ❌ Missing required metadata:", {
        userId: !!userId,
        pack_id: !!pack_id,
        pack_credits: !!pack_credits,
      })
      // Not a PetTaleAI pack checkout (e.g. another app on a shared Stripe account).
      // Acknowledge so Stripe doesn't retry or disable the endpoint.
      return NextResponse.json({ received: true, ignored: "not a PetTaleAI pack checkout" })
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent as any)?.id || ""

    if (!paymentIntentId) {
      console.error("[Webhook] ❌ Missing payment_intent")
      return NextResponse.json({ error: "Missing payment_intent for idempotency" }, { status: 400 })
    }

    // STEP 7: Validate pack exists in database
    const pack = await getPackById(pack_id)
    if (!pack) {
      console.error("[Webhook] ⚠️ Pack not found in database:", pack_id)
      // Don't fail - use metadata as fallback (data integrity issue but don't block payment)
    } else {
      console.log("[Webhook] ✅ Pack validated:", {
        id: pack.id,
        name: pack.name,
        credits: pack.credits,
      })
    }

    // STEP 8: Parse credits amount
    const creditsToGrant = Number.parseInt(pack_credits, 10)
    if (isNaN(creditsToGrant) || creditsToGrant <= 0) {
      console.error("[Webhook] ❌ Invalid pack_credits value:", pack_credits)
      return NextResponse.json({ error: "Invalid pack_credits value" }, { status: 400 })
    }

    console.log("[Webhook] 🎯 Processing pack purchase:", {
      userId,
      pack_id,
      credits: creditsToGrant,
      paymentIntent: paymentIntentId,
    })

    // STEP 9: Grant credits (with built-in idempotency protection)
    const result = await addPurchasedCredits(
      userId,
      creditsToGrant,
      pack_id as "quick_fix" | "party_pack" | "creator_bundle",
      paymentIntentId,
    )

    if (result.error) {
      console.error("[Webhook] ❌ Failed to grant credits:", result.error)
      return NextResponse.json({ error: `Failed to grant credits: ${result.error.message}` }, { status: 500 })
    }

    // STEP 10: Check if duplicate
    if (result.duplicate) {
      console.log("[Webhook] ⚠️ Duplicate payment detected - credits already granted:", {
        userId,
        paymentIntent: paymentIntentId,
      })
      return NextResponse.json({
        received: true,
        duplicate: true,
        message: "Credits already granted for this payment",
      })
    }

    // STEP 11: Success!
    console.log("[Webhook] ✅ Credits granted successfully:", {
      userId,
      pack_id,
      credits: creditsToGrant,
      new_balance: result.data?.total,
      purchased_credits: result.data?.purchased_credits,
      free_credits: result.data?.free_credits,
    })

    return NextResponse.json({
      received: true,
      credits_granted: true,
      new_balance: result.data?.total,
    })
  } catch (error) {
    console.error("[Webhook] 💥 Unexpected error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Webhook processing failed: ${errorMessage}` }, { status: 500 })
  }
}

/**
 * GET handler for webhook status/health check
 */
export async function GET() {
  return NextResponse.json({
    status: "STRIPE WEBHOOK HANDLER FOR CREDIT PACKS",
    version: "v1",
    purpose: "Process checkout.session.completed events for credit pack purchases",
    features: [
      "Signature verification for security",
      "Idempotency protection via payment_intent_id",
      "Comprehensive error handling and logging",
      "Pack validation against database",
    ],
    supported_events: [
      "checkout.session.completed",
      "invoice.paid",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "charge.refunded",
      "charge.dispute.created",
    ],
    required_metadata: ["userId", "pack_id", "pack_credits"],
    required_env_vars: ["STRIPE_WEBHOOK_SECRET"],
    testing: {
      stripe_cli: "stripe listen --forward-to localhost:3000/api/webhooks/stripe",
      test_mode: "Use Stripe test mode checkout to trigger events",
    },
  })
}
