"use client"

const SESSION_STORAGE_PREFIX = "pet_tales_"
const VIEWED_TALES_KEY = `${SESSION_STORAGE_PREFIX}viewed_tales`
const LIKED_TALES_KEY = `${SESSION_STORAGE_PREFIX}liked_tales`
const SESSION_ID_KEY = `${SESSION_STORAGE_PREFIX}session_id`

// Generate or get session ID (client-side)
export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "ssr_fallback"
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = `client_${crypto.randomUUID()}`
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

// View tracking functions
export function hasViewedTale(taleId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const viewedTales = JSON.parse(localStorage.getItem(VIEWED_TALES_KEY) || "[]")
    return viewedTales.includes(taleId)
  } catch {
    return false
  }
}

export function markTaleAsViewed(taleId: string): void {
  if (typeof window === "undefined") return

  try {
    const viewedTales = JSON.parse(localStorage.getItem(VIEWED_TALES_KEY) || "[]")
    if (!viewedTales.includes(taleId)) {
      viewedTales.push(taleId)
      localStorage.setItem(VIEWED_TALES_KEY, JSON.stringify(viewedTales))
      console.log(`📝 Marked tale ${taleId} as viewed in session`)
    }
  } catch (error) {
    console.error("Error marking tale as viewed:", error)
  }
}

// Like tracking functions
export function hasLikedTale(taleId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const likedTales = JSON.parse(localStorage.getItem(LIKED_TALES_KEY) || "[]")
    return likedTales.includes(taleId)
  } catch {
    return false
  }
}

export function toggleTaleLike(taleId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const likedTales = JSON.parse(localStorage.getItem(LIKED_TALES_KEY) || "[]")
    const isCurrentlyLiked = likedTales.includes(taleId)

    if (isCurrentlyLiked) {
      // Remove like
      const updatedLikes = likedTales.filter((id: string) => id !== taleId)
      localStorage.setItem(LIKED_TALES_KEY, JSON.stringify(updatedLikes))
      console.log(`💔 Removed like for tale ${taleId} from session`)
      return false
    } else {
      // Add like
      likedTales.push(taleId)
      localStorage.setItem(LIKED_TALES_KEY, JSON.stringify(likedTales))
      console.log(`❤️ Added like for tale ${taleId} to session`)
      return true
    }
  } catch (error) {
    console.error("Error toggling tale like:", error)
    return false
  }
}

// Clear session data (useful for testing)
export function clearSessionData(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem(VIEWED_TALES_KEY)
  localStorage.removeItem(LIKED_TALES_KEY)
  localStorage.removeItem(SESSION_ID_KEY)
  console.log("🧹 Cleared all session data")
}

// Get session stats (useful for debugging)
export function getSessionStats(): { viewedCount: number; likedCount: number; sessionId: string } {
  if (typeof window === "undefined") {
    return { viewedCount: 0, likedCount: 0, sessionId: "server" }
  }

  try {
    const viewedTales = JSON.parse(localStorage.getItem(VIEWED_TALES_KEY) || "[]")
    const likedTales = JSON.parse(localStorage.getItem(LIKED_TALES_KEY) || "[]")
    const sessionId = getSessionId()

    return {
      viewedCount: viewedTales.length,
      likedCount: likedTales.length,
      sessionId,
    }
  } catch {
    return { viewedCount: 0, likedCount: 0, sessionId: getSessionId() }
  }
}
