export interface CheckoutSessionRequest {
  planId: string
}

export interface CheckoutSessionResponse {
  sessionId: string
  url: string
}

export interface SubscriptionStatus {
  tier: "free" | "basic" | "pro" | "premium"
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete"
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  creditsRemaining: number
  monthlyAllowance: number
}

export type StripeErrorCode =
  | "card_declined"
  | "expired_card"
  | "incorrect_cvc"
  | "processing_error"
  | "incorrect_number"
  | "invalid_expiry_month"
  | "invalid_expiry_year"
  | "insufficient_funds"
  | "rate_limit"
