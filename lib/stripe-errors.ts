import type Stripe from "stripe"
import type { StripeErrorCode } from "@/types/stripe"

export function isStripeError(error: unknown): error is Stripe.StripeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as any).type === "string" &&
    (error as any).type.startsWith("Stripe")
  )
}

export function formatStripeError(error: unknown): string {
  if (!isStripeError(error)) {
    return "An unexpected error occurred. Please try again."
  }

  const code = error.code as StripeErrorCode | undefined

  switch (code) {
    case "card_declined":
      return "Your card was declined. Please try a different payment method."
    case "expired_card":
      return "Your card has expired. Please use a different card."
    case "incorrect_cvc":
      return "The security code (CVC) is incorrect. Please check and try again."
    case "processing_error":
      return "An error occurred while processing your card. Please try again."
    case "incorrect_number":
      return "The card number is incorrect. Please check and try again."
    case "invalid_expiry_month":
    case "invalid_expiry_year":
      return "The expiration date is invalid. Please check and try again."
    case "insufficient_funds":
      return "Your card has insufficient funds. Please try a different card."
    case "rate_limit":
      return "Too many requests. Please wait a moment and try again."
    default:
      return error.message || "An error occurred with your payment. Please try again."
  }
}

export function getStripeErrorCode(error: unknown): StripeErrorCode | null {
  if (isStripeError(error) && error.code) {
    return error.code as StripeErrorCode
  }
  return null
}
