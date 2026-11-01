export type BillingInterval = "monthly" | "annual"

export interface PricingTier {
  id: "basic" | "pro" | "premium"
  name: string
  description: string
  monthlyPrice: number
  annualPrice: number
  credits: number
  features: string[]
  stripePriceIds: {
    monthly: string
    annual: string
  }
  popular?: boolean
}

/**
 * Helper function to get required environment variable with clear error message
 * Only runs when actually accessed, not at module load time
 */
function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Please add this to your Vercel project settings.\n` +
        `Go to: Vercel Dashboard → Your Project → Settings → Environment Variables`,
    )
  }
  return value
}

/**
 * Pricing tiers configuration
 * Uses getter functions for stripePriceIds to enable lazy evaluation
 */
export const pricingTiers: PricingTier[] = [
  {
    id: "basic",
    name: "Basic",
    description: "Perfect for casual pet owners",
    monthlyPrice: 9,
    annualPrice: 90,
    credits: 25,
    features: [
      "25 videos per month",
      "Standard processing",
      "HD video quality",
      "Email support",
      "All personality voices",
    ],
    // Getter function - only evaluates when accessed
    get stripePriceIds() {
      return {
        monthly: getRequiredEnvVar("STRIPE_BASIC_MONTHLY_PRICE_ID"),
        annual: getRequiredEnvVar("STRIPE_BASIC_ANNUAL_PRICE_ID"),
      }
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For active pet owners",
    monthlyPrice: 19,
    annualPrice: 190,
    credits: 75,
    popular: true,
    features: [
      "75 videos per month",
      "Priority processing",
      "HD video quality",
      "Priority email support",
      "All personality voices",
      "Custom voices (coming soon)",
    ],
    // Getter function - only evaluates when accessed
    get stripePriceIds() {
      return {
        monthly: getRequiredEnvVar("STRIPE_PRO_MONTHLY_PRICE_ID"),
        annual: getRequiredEnvVar("STRIPE_PRO_ANNUAL_PRICE_ID"),
      }
    },
  },
  {
    id: "premium",
    name: "Premium",
    description: "For pet content creators",
    monthlyPrice: 49,
    annualPrice: 490,
    credits: 200,
    features: [
      "200 videos per month",
      "Priority processing",
      "4K video quality",
      "Priority support",
      "All personality voices",
      "Custom voices",
      "API access (coming soon)",
      "White-label option (coming soon)",
    ],
    // Getter function - only evaluates when accessed
    get stripePriceIds() {
      return {
        monthly: getRequiredEnvVar("STRIPE_PREMIUM_MONTHLY_PRICE_ID"),
        annual: getRequiredEnvVar("STRIPE_PREMIUM_ANNUAL_PRICE_ID"),
      }
    },
  },
]

export function getPricingTier(tierId: string): PricingTier | undefined {
  return pricingTiers.find((tier) => tier.id === tierId)
}

export function getAnnualSavings(tier: PricingTier): number {
  return tier.monthlyPrice * 12 - tier.annualPrice
}

export function getAnnualSavingsPercentage(tier: PricingTier): number {
  const savings = getAnnualSavings(tier)
  const annualCostIfMonthly = tier.monthlyPrice * 12
  return Math.round((savings / annualCostIfMonthly) * 100)
}

/**
 * Returns all valid Stripe price IDs for validation in API routes
 * Accessing stripePriceIds triggers the getter functions
 */
export function validatePriceIds(): string[] {
  const allPriceIds: string[] = []

  pricingTiers.forEach((tier) => {
    const ids = tier.stripePriceIds // Triggers getter
    if (ids.monthly) {
      allPriceIds.push(ids.monthly)
    }
    if (ids.annual) {
      allPriceIds.push(ids.annual)
    }
  })

  return allPriceIds
}
