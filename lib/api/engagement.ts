/**
 * Client-side API helpers for engagement actions
 * These functions make fetch calls to API endpoints and can be used in client components
 */

interface ViewResult {
  success: boolean
  viewCount?: number
  alreadyViewed?: boolean
  error?: string
}

interface LikeResult {
  success: boolean
  likeCount?: number
  liked?: boolean
  error?: string
}

/**
 * Records a view for a public tale via the unified API endpoint
 */
export async function recordPublicViewClient(entryId: string): Promise<ViewResult> {
  try {
    const response = await fetch("/api/engagement/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Ensures cookies (pt_session) are sent
      body: JSON.stringify({
        entryId,
        entryType: "tale", // Default to tale for public views
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error recording public view:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Toggles a like for a public tale via the public engagement API
 */
export async function togglePublicLikeClient(taleId: string, sessionId: string): Promise<LikeResult> {
  try {
    const response = await fetch("/api/public-engagement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Ensures cookies are sent
      body: JSON.stringify({
        action: "like",
        taleId,
        sessionId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error toggling public like:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
