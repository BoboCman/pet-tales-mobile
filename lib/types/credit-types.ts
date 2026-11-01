export interface PreflightCheckResult {
  ok: boolean
  balance: number
  code?: string
  message?: string
}

export const CREDIT_MESSAGES = {
  OUT_OF_CREDITS: "You're out of credits.",
  AUTH_REQUIRED: "Please sign in to continue.",
  SERVER_ERROR: "Unable to check credit balance.",
  UNEXPECTED_ERROR: "An unexpected error occurred.",
} as const
