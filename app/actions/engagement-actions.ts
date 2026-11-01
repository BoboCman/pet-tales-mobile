"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface EngagementResult {
  success: boolean
  error?: string
  liked?: boolean
  likeCount?: number
  viewCount?: number
  shareUrl?: string
  platform?: string
  message?: string
  sessionId?: string
  alreadyViewed?: boolean
}

export async function toggleEntryLike(entryId: string): Promise<EngagementResult> {
  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: "Authentication required",
      }
    }

    // Check if user has already liked this entry using the diary_entry_likes table
    const { data: existingLike, error: likeCheckError } = await supabase
      .from("diary_entry_likes")
      .select("id")
      .eq("diary_entry_id", entryId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (likeCheckError) {
      console.error("Error checking existing like:", likeCheckError)
      return {
        success: false,
        error: "Failed to check like status",
      }
    }

    const hasLiked = !!existingLike

    if (hasLiked) {
      // Remove like from diary_entry_likes table
      const { error: deleteError } = await supabase
        .from("diary_entry_likes")
        .delete()
        .eq("diary_entry_id", entryId)
        .eq("user_id", user.id)

      if (deleteError) {
        console.error("Error removing like:", deleteError)
        return {
          success: false,
          error: "Failed to remove like",
        }
      }
    } else {
      // Add like to diary_entry_likes table
      const { error: insertError } = await supabase.from("diary_entry_likes").insert({
        diary_entry_id: entryId,
        user_id: user.id,
      })

      if (insertError) {
        console.error("Error adding like:", insertError)
        return {
          success: false,
          error: "Failed to add like",
        }
      }
    }

    // Get updated like count from diary_entries (updated by trigger)
    const { data: entryData, error: countError } = await supabase
      .from("diary_entries")
      .select("like_count")
      .eq("id", entryId)
      .single()

    if (countError) {
      console.error("Error getting updated like count:", countError)
      return {
        success: false,
        error: "Failed to get updated like count",
      }
    }

    // Revalidate the paths that might show this data
    revalidatePath("/dashboard/reels")
    revalidatePath(`/dashboard/reels/${entryId}`)
    revalidatePath("/community/public")

    return {
      success: true,
      liked: !hasLiked,
      likeCount: entryData.like_count || 0,
    }
  } catch (error) {
    console.error("Error in toggleEntryLike:", error)
    return {
      success: false,
      error: "An unexpected error occurred",
    }
  }
}

export async function recordEntryView(entryId: string): Promise<EngagementResult> {
  try {
    console.log(`🔍 Recording view for entry: ${entryId}`)

    const response = await fetch("/api/engagement/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entryId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log(`✅ View recorded successfully via unified API. Result:`, result)

    // Revalidate relevant paths
    revalidatePath("/dashboard/reels")
    revalidatePath(`/dashboard/reels/${entryId}`)
    revalidatePath("/community/public")

    return {
      success: result.success,
      viewCount: result.viewCount,
      alreadyViewed: result.alreadyViewed,
    }
  } catch (error) {
    console.error("❌ Error in recordEntryView:", error)
    return {
      success: false,
      error: "An unexpected error occurred",
    }
  }
}

/**
 * SERVER-ONLY: Do not import in client components
 * Use recordPublicViewClient from @/lib/api/engagement instead
 */
export async function recordPublicView(taleId: string, sessionId: string): Promise<EngagementResult> {
  try {
    console.log(`📊 Recording view for tale ${taleId} (legacy sessionId parameter ignored)`)

    const response = await fetch("/api/engagement/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entryId: taleId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log(`👁️ View recording result:`, result)

    // Revalidate the community page to show updated view counts
    revalidatePath("/community/public")
    revalidatePath(`/community/public/${taleId}`)

    return result
  } catch (error) {
    console.error("❌ Error recording public view:", error)
    return { success: false, error: "Failed to record view" }
  }
}

/**
 * SERVER-ONLY: Do not import in client components
 * Use togglePublicLikeClient from @/lib/api/engagement instead
 */
export async function togglePublicLike(taleId: string, sessionId: string): Promise<EngagementResult> {
  try {
    console.log(`❤️ Toggling like for tale ${taleId} with session ${sessionId}`)

    const response = await fetch("/api/public-engagement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "like",
        taleId,
        sessionId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log(`❤️ Like toggle result:`, result)

    // Revalidate the community page to show updated like counts
    revalidatePath("/community/public")
    revalidatePath(`/community/public/${taleId}`)

    return result
  } catch (error) {
    console.error("❌ Error toggling public like:", error)
    return { success: false, error: "Failed to update like" }
  }
}

// Alias functions for backward compatibility
export const incrementViewCount = recordEntryView
export const toggleLike = toggleEntryLike
