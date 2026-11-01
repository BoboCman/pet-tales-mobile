import type { Session, User } from "@supabase/supabase-js"

/**
 * Authentication context passed to authenticated route handlers
 */
export interface AuthContext {
  session: Session
  user: User
  userId: string
  userEmail: string
}

/**
 * Admin context passed to admin-only route handlers
 * Extends AuthContext with admin-specific fields
 */
export interface AdminContext extends AuthContext {
  isAdmin: true
  adminEmail: string
}

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator: (request: Request) => string
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Session verification result
 */
export interface SessionVerificationResult {
  session: Session | null
  user: User | null
  error: string | null
}

/**
 * Admin verification result
 */
export interface AdminVerificationResult {
  isAdmin: boolean
  user: AdminUser | null
  error: string | null
}

/**
 * Admin user data
 */
export interface AdminUser {
  id: string
  email: string
  is_admin: boolean
}

/**
 * Request validation result
 */
export interface RequestValidationResult {
  valid: boolean
  error: string | null
}

/**
 * Security headers for API responses
 */
export interface SecurityHeaders {
  "X-Content-Type-Options": string
  "X-Frame-Options": string
  "X-XSS-Protection": string
  "Strict-Transport-Security": string
  "Content-Security-Policy": string
}

/**
 * API request log data
 */
export interface ApiRequestLog {
  userId: string | null
  endpoint: string
  method: string
  ipAddress: string | null
  userAgent: string | null
  statusCode: number
  duration: number
  error?: string
}
