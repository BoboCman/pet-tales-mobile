import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getOrCreateStripeCustomer } from "@/lib/stripe/customer"
import { createClient } from "@/lib/supabase/server"
import { formatStripeError } from "@/lib/stripe-errors"
import { getPackById } from "@/lib/stripe/pack-config"
import { isStripeTestMode, TEST_CARD_INFO } from "@/lib/stripe/test-mode"
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
          message: "Please sign in to purchase credits",
        },
        { status: 401 },
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { pack_id } = body

    if (!pack_id) {
      return NextResponse.json(
        {
          error: "Pack ID is required",
          message: "Please select a credit pack to continue",
        },
        { status: 400 },
      )
    }

    // 3. Get user from database
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, stripe_customer_id, full_name, name")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      console.error("[Pack Checkout] Error fetching user:", userError)
      return NextResponse.json(
        {
          error: "User not found",
          message: "Could not find your account. Please try logging in again.",
        },
        { status: 404 },
      )
    }

    // 4. Validate pack
    const pack = await getPackById(pack_id)

    if (!pack) {
      return NextResponse.json(
        {
          error: "Pack not found",
          message: "The selected pack could not be found",
        },
        { status: 404 },
      )
    }

    if (!pack.active) {
      return NextResponse.json(
        {
          error: "Pack not available",
          message: "This pack is not available",
        },
        { status: 400 },
      )
    }

    // 5. Create or retrieve Stripe customer (replaces IDs left over from the old Stripe account)
    const customerId = await getOrCreateStripeCustomer(userData, "[Pack Checkout]")

    // 6. Get origin for redirect URLs
    const origin = request.headers.get("origin") || getAppBaseUrl("http://localhost:3000")

    console.log("[Pack Checkout] Creating checkout session:", {
      customerId,
      pack_id: pack.id,
      userId: userData.id,
    })

    // 7. Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: pack.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&pack_purchase=success`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        userId: userData.id,
        pack_id: pack.id,
        pack_credits: pack.credits.toString(),
      },
      customer_update: {
        address: "auto",
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",

      ...(isStripeTestMode() && {
        custom_text: {
          submit: {
            message: `TEST MODE: Use card ${TEST_CARD_INFO.number} • Expiry ${TEST_CARD_INFO.expiry} • CVC ${TEST_CARD_INFO.cvc} • ZIP ${TEST_CARD_INFO.zip}`,
          },
        },
      }),
    })

    console.log("[Pack Checkout] Checkout session created successfully:", {
      sessionId: session.id,
      url: session.url,
    })

    // 8. Return session ID and checkout URL
    return NextResponse.json({
      sessionId: session.id,
      url: session.url || "",
    })
  } catch (error) {
    console.error("[Pack Checkout] Error creating checkout session:", error)

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
