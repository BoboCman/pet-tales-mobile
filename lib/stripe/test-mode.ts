/**
 * Stripe test mode detection and test card constants
 */

/**
 * Check if Stripe is in test mode
 * @returns true if using test publishable key
 */
export function isStripeTestMode(): boolean {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  return publishableKey.includes("test") || publishableKey.startsWith("pk_test_")
}

/**
 * Test card information for Stripe test mode
 */
export const TEST_CARD_INFO = {
  number: "4242 4242 4242 4242",
  expiry: "12/34",
  cvc: "123",
  zip: "12345",
  description: "Use these test card details for purchasing credits in test mode",
} as const

/**
 * Additional test cards for different scenarios
 */
export const TEST_CARDS = {
  success: {
    number: "4242 4242 4242 4242",
    description: "Always succeeds",
  },
  requires3DS: {
    number: "4000 0025 0000 3155",
    description: "Requires 3D Secure authentication",
  },
  declined: {
    number: "4000 0000 0000 0002",
    description: "Card declined (for testing errors)",
  },
  insufficientFunds: {
    number: "4000 0000 0000 9995",
    description: "Insufficient funds (for testing errors)",
  },
} as const
