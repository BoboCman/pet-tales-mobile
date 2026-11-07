import { stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabase/admin"

interface BillingUser {
  id: string
  email: string | null
  stripe_customer_id: string | null
  full_name?: string | null
  name?: string | null
}

/**
 * True when the saved customer exists in the Stripe account this app uses now.
 *
 * Users who paid before PetTaleAI moved to its own Stripe account have a customer ID from the
 * old (shared) account. Stripe rejects that ID with "No such customer", which would break
 * checkout and the billing portal for exactly the people who already paid us.
 */
export async function customerExists(customerId: string | null | undefined): Promise<boolean> {
  if (!customerId) return false
  try {
    const customer = await stripe.customers.retrieve(customerId)
    return !(customer as { deleted?: boolean }).deleted
  } catch (error: any) {
    if (error?.code === "resource_missing" || error?.statusCode === 404) return false
    throw error
  }
}

/** The user's Stripe customer in the current account, created (and saved) when missing. */
export async function getOrCreateStripeCustomer(user: BillingUser, logPrefix: string): Promise<string> {
  if (await customerExists(user.stripe_customer_id)) {
    return user.stripe_customer_id as string
  }

  if (user.stripe_customer_id) {
    console.warn(`${logPrefix} Saved Stripe customer ${user.stripe_customer_id} not found in this account; creating a new one`)
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.full_name || user.name || user.email?.split("@")[0] || undefined,
    metadata: { userId: user.id },
  })
  console.log(`${logPrefix} Created Stripe customer:`, customer.id)

  // Service role: billing columns are locked against user-session writes
  const { error } = await supabaseAdmin.from("users").update({ stripe_customer_id: customer.id }).eq("id", user.id)
  if (error) {
    // Continue anyway: the customer exists in Stripe and webhooks also match on metadata.userId
    console.error(`${logPrefix} Error saving Stripe customer ID:`, error)
  }

  return customer.id
}
