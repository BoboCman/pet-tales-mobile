import type { ApiRequestLog } from "./types"

/**
 * Log API request with structured format
 * Currently logs to console, will be extended to database in future
 */
export async function logApiRequest(data: ApiRequestLog): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: data.userId,
    endpoint: data.endpoint,
    method: data.method,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    statusCode: data.statusCode,
    duration: data.duration,
    error: data.error,
  }

  console.log("[API Request]", JSON.stringify(logEntry))
}

/**
 * Log failed authentication attempt
 */
export async function logFailedAuth(ipAddress: string, reason: string): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: "failed_auth",
    ipAddress,
    reason,
  }

  console.error("[Failed Auth]", JSON.stringify(logEntry))
}

/**
 * Log rate limit hit
 */
export async function logRateLimitHit(userId: string, endpoint: string): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: "rate_limit_hit",
    userId,
    endpoint,
  }

  console.warn("[Rate Limit]", JSON.stringify(logEntry))
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(adminId: string, action: string, metadata: object): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: "admin_action",
    adminId,
    action,
    metadata,
  }

  console.log("[Admin Action]", JSON.stringify(logEntry))
}
