/**
 * Enhanced Client Logger for Production Security
 * Provides development debugging while protecting sensitive data in production
 */

type LogCategory = "VideoPlayer" | "DataUpload" | "PetManagement" | "Storage" | "Database" | "API" | "UI" | "Auth"

interface LogData {
  [key: string]: any
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === "development"

  /**
   * Development-only logging with full data exposure
   * Completely silent in production
   */
  dev(category: LogCategory, message: string, data?: LogData): void {
    if (this.isDevelopment) {
      const emoji = this.getCategoryEmoji(category)
      console.log(`${emoji} [${category}] ${message}`, data || "")
    }
  }

  /**
   * Safe info logging - sanitized for production
   * Shows basic flow without sensitive data
   */
  info(category: LogCategory, message: string, safeData?: string | number | boolean): void {
    if (this.isDevelopment) {
      const emoji = this.getCategoryEmoji(category)
      console.info(`${emoji} [${category}] ${message}`, safeData || "")
    }
    // In production, only log basic flow without data
    else if (process.env.NODE_ENV === "production" && this.isImportantFlow(category)) {
      console.info(`[${category}] ${message}`)
    }
  }

  /**
   * Error logging with production sanitization
   * Always logs errors but protects sensitive data in production
   */
  error(category: LogCategory, message: string, error?: any): void {
    const emoji = this.getCategoryEmoji(category)
    if (this.isDevelopment) {
      console.error(`${emoji} [${category}] ${message}`, error)
    } else {
      // Production: Log error message but not sensitive error details
      console.error(`[${category}] ${message}`)
      // Only log safe error properties
      if (error && typeof error === "object") {
        const safeError = {
          name: error.name,
          message: this.sanitizeErrorMessage(error.message),
        }
        console.error("Error details:", safeError)
      }
    }
  }

  /**
   * Warning logging with production safety
   */
  warn(category: LogCategory, message: string, data?: any): void {
    const emoji = this.getCategoryEmoji(category)
    if (this.isDevelopment) {
      console.warn(`${emoji} [${category}] ${message}`, data)
    } else {
      console.warn(`[${category}] ${message}`)
    }
  }

  /**
   * Success logging for important operations
   */
  success(category: LogCategory, message: string, safeData?: string | number): void {
    if (this.isDevelopment) {
      const emoji = this.getCategoryEmoji(category)
      console.log(`✅ [${category}] ${message}`, safeData || "")
    }
  }

  /**
   * Progress logging for uploads and long operations
   */
  progress(category: LogCategory, message: string, percentage?: number): void {
    if (this.isDevelopment) {
      const emoji = this.getCategoryEmoji(category)
      const progressText = percentage !== undefined ? ` (${percentage}%)` : ""
      console.log(`⏳ [${category}] ${message}${progressText}`)
    }
  }

  private getCategoryEmoji(category: LogCategory): string {
    const emojiMap: Record<LogCategory, string> = {
      VideoPlayer: "🎬",
      DataUpload: "📤",
      PetManagement: "🐾",
      Storage: "💾",
      Database: "🗄️",
      API: "🔌",
      UI: "🎨",
      Auth: "🔐",
    }
    return emojiMap[category] || "📝"
  }

  private isImportantFlow(category: LogCategory): boolean {
    // Only log important flows in production for monitoring
    return ["Auth", "DataUpload", "Database"].includes(category)
  }

  private sanitizeErrorMessage(message: string): string {
    if (!message) return "Unknown error"
    // Remove sensitive patterns from error messages
    return message
      .replace(/https?:\/\/[^\s]+/g, "[URL_REMOVED]")
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "[UUID_REMOVED]")
      .replace(/supabase\.co/gi, "[STORAGE_REMOVED]")
      .replace(/cloudinary\.com/gi, "[CDN_REMOVED]")
      .replace(/Bearer\s+[^\s]+/gi, "[TOKEN_REMOVED]")
  }
}

export const clientLogger = new ClientLogger()

// Convenience exports for common patterns
export const logDev = clientLogger.dev.bind(clientLogger)
export const logInfo = clientLogger.info.bind(clientLogger)
export const logError = clientLogger.error.bind(clientLogger)
export const logWarn = clientLogger.warn.bind(clientLogger)
export const logSuccess = clientLogger.success.bind(clientLogger)
export const logProgress = clientLogger.progress.bind(clientLogger)
