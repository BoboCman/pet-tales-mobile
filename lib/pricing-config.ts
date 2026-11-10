/**
 * Subscription plans (monthly only for launch).
 *
 * Each plan grants a set number of tales per billing month. Unused plan tales roll over, capped at
 * two months' worth (lib/credits/subscriptions.ts). Tales bought in packs never expire and are used
 * after plan tales.
 *
 * Stripe price IDs come from env vars. A plan whose env var is missing is shown as
 * "coming soon" and cannot be checked out, so the app never crashes on a missing price.
 *
 * Plain data only (no secrets), so it is safe to import from client components.
 */

export type PlanId = "pet_parent" | "super_fan"

export interface SubscriptionPlan {
  id: PlanId
  name: string
  description: string
  /** Monthly price in US dollars */
  monthlyPrice: number
  /** Tales granted each billing month */
  talesPerMonth: number
  features: string[]
  popular?: boolean
}

/** Free tier: one tale at signup, then subscribe. No recurring free tales. */
export const FREE_TIER = {
  welcomeTales: 1,
} as const

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "pet_parent",
    name: "Pet Parent",
    description: "For pet owners who share a few moments a month",
    monthlyPrice: 4.99,
    talesPerMonth: 10,
    features: ["10 tales every month", "All narrator voices and vibes", "Share anywhere with one link", "Cancel anytime"],
  },
  {
    id: "super_fan",
    name: "Super Fan",
    description: "For owners who post every few days",
    monthlyPrice: 9.99,
    talesPerMonth: 25,
    popular: true,
    features: [
      "25 tales every month",
      "All narrator voices and vibes",
      "Tales for all your pets",
      "Share anywhere with one link",
      "Cancel anytime",
    ],
  },
]

/** Server-only: env var that holds each plan's Stripe monthly price ID */
const PRICE_ENV_VARS: Record<PlanId, string> = {
  pet_parent: "STRIPE_PET_PARENT_MONTHLY_PRICE_ID",
  super_fan: "STRIPE_SUPER_FAN_MONTHLY_PRICE_ID",
}

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return subscriptionPlans.find((plan) => plan.id === planId)
}

/** Server-only: the plan's Stripe price ID, or null if not configured */
export function getPlanPriceId(planId: PlanId): string | null {
  const value = process.env[PRICE_ENV_VARS[planId]]
  return value && value.trim() ? value.trim() : null
}

/** Server-only: find the plan a Stripe price ID belongs to */
export function getPlanByPriceId(priceId: string | null | undefined): SubscriptionPlan | undefined {
  if (!priceId) return undefined
  return subscriptionPlans.find((plan) => getPlanPriceId(plan.id) === priceId)
}

/** Server-only: IDs of plans that have a Stripe price configured */
export function getConfiguredPlanIds(): PlanId[] {
  return subscriptionPlans.filter((plan) => getPlanPriceId(plan.id)).map((plan) => plan.id)
}

/**
 * A one-time tale pack that is on sale right now (worked out on the server by getPackOffer in
 * lib/stripe/pack-offer.ts). Plain data, so it can be passed to client components.
 */
export interface PackOffer {
  id: string
  tales: number
  priceCents: number
}

export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** "3 tales for $2.99" */
export const packLabel = (offer: PackOffer) => `${offer.tales} tales for ${formatUsd(offer.priceCents)}`

/** The cheapest plan, used for "plans from $4.99 a month" */
export const cheapestPlan = [...subscriptionPlans].sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0]

/** "$4.99 a month" */
export const plansFromLabel = `$${cheapestPlan.monthlyPrice.toFixed(2)} a month`

/** One line for every "what does it cost" spot, so they all stay in step with what is on sale */
export function priceSummary(offer: PackOffer | null): string {
  return offer
    ? `${packLabel(offer)}, or plans from ${plansFromLabel}`
    : `Plans from ${plansFromLabel}`
}

/** Lowest price someone can pay today: "$2.99" with a pack on sale, otherwise "$4.99" */
export function startingPrice(offer: PackOffer | null): string {
  return offer ? formatUsd(offer.priceCents) : `$${cheapestPlan.monthlyPrice.toFixed(2)}`
}
