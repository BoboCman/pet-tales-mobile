import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer"
import { createClient } from "@/lib/supabase/server"
import { formatStripeError } from "@/lib/stripe-errors"
import { getPlanById, getPlanPriceId } from "@/lib/pricing-config"
import type { CheckoutSessionRequest, CheckoutSessionResponse } from "@/types/stripe"
import { getAppBaseUrl } from "@/lib/utils/app-url"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to subscribe to a plan",
        },
        { status: 401 },
      )
    }

    // 2. Parse request body
    const body: CheckoutSessionRequest = await request.json()
    const plan = body.planId ? getPlanById(body.planId) : undefined

    if (!plan) {
      return NextResponse.json(
        {
          error: "Invalid plan",
          message: "Please select a plan to continue",
        },
        { status: 400 },
      )
    }

    // 3. Resolve the plan's Stripe price on the server (never trust a price from the client)
    const priceId = getPlanPriceId(plan.id)

    if (!priceId) {
      console.error(`[Checkout] No Stripe price configured for plan ${plan.id}`)
      return NextResponse.json(
        {
          error: "Plan not available",
          message: "This plan isn't available yet. Please try again soon.",
        },
        { status: 503 },
      )
    }

    // 4. Get user from database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, stripe_customer_id, full_name, name")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      console.error("[Checkout] Error fetching user:", userError)
      return NextResponse.json(
        {
          error: "User not found",
          message: "Could not find your account. Please try logging in again.",
        },
        { status: 404 },
      )
    }

    // 4b. Don't start a second subscription for someone who already has one
    const { data: subData } = await supabase
      .from("users")
      .select("subscription_status")
      .eq("id", user.id)
      .single()

    if (["active", "trialing", "past_due"].includes(subData?.subscription_status ?? "")) {
      return NextResponse.json(
        {
          error: "Already subscribed",
          message: "You already have a plan. Manage it from Settings.",
        },
        { status: 409 },
      )
    }

    // 5. Create or retrieve Stripe customer (replaces IDs left over from the old Stripe account)
    const customerId = await getOrCreateStripeCustomer(userData, "[Checkout]")

    // 6. Get origin for redirect URLs
    const origin = request.headers.get("origin") || getAppBaseUrl("http://localhost:3000")

    console.log("[Checkout] Creating checkout session:", {
      customerId,
      priceId,
      userId: userData.id,
    })

    // 7. Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/pricing?session_id={CHECKOUT_SESSION_ID}&subscribed=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        userId: userData.id,
        planId: plan.id,
      },
      customer_update: {
        address: "auto",
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      subscription_data: {
        metadata: {
          userId: userData.id,
          planId: plan.id,
        },
      },
    })

    console.log("[Checkout] Checkout session created successfully:", {
      sessionId: session.id,
      url: session.url,
    })

    // 8. Return session ID and checkout URL
    const response: CheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url || "",
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Checkout] Error creating checkout session:", error)

    const errorMessage = formatStripeError(error)

    return NextResponse.json(
      {
        error: errorMessage,
        message: "Failed to create checkout session. Please try again.",
      },
      { status: 500 },
    )
  }
}
