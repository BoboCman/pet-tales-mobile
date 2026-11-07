import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { customerExists } from "@/lib/stripe/customer"
import { createClient } from "@/lib/supabase/server"
import { formatStripeError } from "@/lib/stripe-errors"
import { getAppBaseUrl } from "@/lib/utils/app-url"

export const dynamic = "force-dynamic"

/**
 * Opens Stripe's customer portal so a subscriber can change their card or cancel their plan.
 * Requires the Customer Portal to be enabled in the Stripe dashboard (Settings → Billing → Customer portal).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", message: "Please sign in" }, { status: 401 })
    }

    const { data: userData } = await supabase.from("users").select("stripe_customer_id").eq("id", user.id).single()

    // A customer ID from the old Stripe account can't open this account's portal
    if (!userData?.stripe_customer_id || !(await customerExists(userData.stripe_customer_id))) {
      return NextResponse.json(
        { error: "No billing account", message: "You don't have a plan to manage yet." },
        { status: 404 },
      )
    }

    const origin = request.headers.get("origin") || getAppBaseUrl("http://localhost:3000")
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: `${origin}/dashboard/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[BillingPortal] Error creating portal session:", error)
    return NextResponse.json(
      { error: formatStripeError(error), message: "Couldn't open billing. Please try again." },
      { status: 500 },
    )
  }
}
