"use client"

import { useState, useCallback } from "react"
import { recordPublicViewClient, togglePublicLikeClient } from "@/lib/api/engagement"
import {
  getSessionId,
  hasViewedTale,
  markTaleAsViewed,
  hasLikedTale,
  toggleTaleLike,
} from "@/lib/session/client-session"

interface UsePublicEngagementProps {
  taleId: string
  initialViewCount: number
  initialLikeCount: number
}

interface UsePublicEngagementReturn {
  viewCount: number
  likeCount: number
  isLiked: boolean
  recordView: () => Promise<void>
  toggleLike: () => Promise<void>
}

export function usePublicEngagement({
  taleId,
  initialViewCount,
  initialLikeCount,
}: UsePublicEngagementProps): UsePublicEngagementReturn {
  const [viewCount, setViewCount] = useState(initialViewCount)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [isLiked, setIsLiked] = useState(() => hasLikedTale(taleId))
  const [isRecordingView, setIsRecordingView] = useState(false)
  const [isTogglingLike, setIsTogglingLike] = useState(false)

  const recordView = useCallback(async () => {
    if (isRecordingView) return

    // Check if already viewed in this session
    if (hasViewedTale(taleId)) {
      console.log(`⚠️ Tale ${taleId} already viewed in this session`)
      return
    }

    setIsRecordingView(true)

    try {
      console.log(`🔍 Recording view for tale ${taleId} via unified API`)

      const result = await recordPublicViewClient(taleId)

      if (result.success) {
        if (!result.alreadyViewed) {
          // Mark as viewed in session storage
          markTaleAsViewed(taleId)

          // Update view count if provided
          if (result.viewCount !== undefined) {
            setViewCount(result.viewCount)
            console.log(`✅ View recorded via unified API, new count: ${result.viewCount}`)
          }
        } else {
          console.log(`⚠️ View already recorded for this session`)
        }
      } else {
        console.error(`❌ Failed to record view: ${result.error}`)
      }
    } catch (error) {
      console.error("❌ Error recording view:", error)
    } finally {
      setIsRecordingView(false)
    }
  }, [taleId, isRecordingView])

  const toggleLike = useCallback(async () => {
    if (isTogglingLike) return

    setIsTogglingLike(true)

    // Optimistic update
    const newIsLiked = !isLiked
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1)

    setIsLiked(newIsLiked)
    setLikeCount(newLikeCount)

    // Update session storage
    toggleTaleLike(taleId)

    try {
      const sessionId = getSessionId()
      console.log(`❤️ Toggling like for tale ${taleId} with session ${sessionId}`)

      const result = await togglePublicLikeClient(taleId, sessionId)

      if (result.success && result.likeCount !== undefined) {
        // Update with actual database count
        setLikeCount(result.likeCount)
        console.log(`✅ Like toggled, new count: ${result.likeCount}`)
      } else {
        // Revert optimistic update on failure
        setIsLiked(!newIsLiked)
        setLikeCount(likeCount)
        toggleTaleLike(taleId) // Revert session storage
        console.error(`❌ Failed to toggle like: ${result.error}`)
      }
    } catch (error) {
      console.error("❌ Error toggling like:", error)
      // Revert optimistic update
      setIsLiked(!newIsLiked)
      setLikeCount(likeCount)
      toggleTaleLike(taleId) // Revert session storage
    } finally {
      setIsTogglingLike(false)
    }
  }, [taleId, isLiked, likeCount, isTogglingLike])

  return {
    viewCount,
    likeCount,
    isLiked,
    recordView,
    toggleLike,
  }
}
