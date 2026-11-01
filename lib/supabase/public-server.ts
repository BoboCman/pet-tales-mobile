import { createClient } from "@/lib/supabase/server"

export async function getPublicTales(limit = 20) {
  try {
    console.log("getPublicTales: Starting query...")
    const supabase = await createClient()

    // Get diary entries with all the pet data that's already stored in the table, excluding billing_required entries
    const { data, error } = await supabase
      .from("diary_entries")
      .select(`
        id,
        title,
        content,
        mood,
        image_url,
        video_url,
        optimized_video_url,
        merged_video_url,
        narration_style,
        narration_genre,
        created_at,
        view_count,
        like_count,
        pets (
          id,
          name,
          breed,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .eq("is_public", true)
      .neq("billing_status", "billing_required") // Exclude billing_required entries
      .order("created_at", { ascending: false })
      .limit(limit)

    console.log("getPublicTales: Entries query result:", { data: data?.length, error })

    if (error) {
      console.error("Error fetching diary entries:", error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log("getPublicTales: No public entries found")
      return []
    }

    console.log("getPublicTales: Transformed entries:", data.length)
    console.log(
      "getPublicTales: Sample entry:",
      data[0]
        ? {
            id: data[0].id,
            title: data[0].title,
            petName: data[0].pets?.name,
            petType: data[0].pets?.type,
            viewCount: data[0].view_count,
            likeCount: data[0].like_count,
          }
        : "No entries",
    )

    return data
  } catch (error) {
    console.error("Error fetching public tales:", error)
    throw error
  }
}

export async function getPublicTaleById(id: string) {
  try {
    console.log("getPublicTaleById: Fetching tale:", id)
    const supabase = await createClient()

    // Get the diary entry with pet data and latest engagement stats, excluding billing_required entries
    const { data, error } = await supabase
      .from("diary_entries")
      .select(`
        id,
        title,
        content,
        mood,
        image_url,
        video_url,
        optimized_video_url,
        merged_video_url,
        narration_style,
        narration_genre,
        created_at,
        view_count,
        like_count,
        pets (
          id,
          name,
          breed,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .eq("id", id)
      .eq("is_public", true)
      .neq("billing_status", "billing_required") // Exclude billing_required entries
      .single()

    if (error || !data) {
      console.error("Error fetching public tale:", error)
      return null
    }

    console.log("getPublicTaleById: Found tale:", {
      id: data.id,
      title: data.title,
      petName: data.pets?.name,
      viewCount: data.view_count,
      likeCount: data.like_count,
    })

    return data
  } catch (error) {
    console.error("Error fetching public tale:", error)
    return null
  }
}

// Direct database update functions for public engagement
export async function recordPublicView(taleId: string, sessionId: string, ip?: string, ua?: string) {
  const supabase = await createClient()

  try {
    console.log(`👁️ Recording view for tale ${taleId} with session ${sessionId}`)

    // Use the SECURITY DEFINER RPC function instead of direct updates
    const { data: viewCount, error } = await supabase.rpc("record_view", {
      entry_id: taleId,
      session_id: sessionId,
      ip: ip || null,
      ua: ua || null,
    })

    if (error) {
      console.error("❌ Error recording view via RPC:", error)
      return { success: false, error: "Failed to record view" }
    }

    console.log(`✅ View recorded successfully for tale ${taleId}. New count: ${viewCount}`)
    return {
      success: true,
      alreadyViewed: false, // RPC handles deduplication internally
      viewCount: viewCount || 0,
    }
  } catch (error) {
    console.error("❌ Error in recordPublicView:", error)
    return { success: false, error: "Internal server error" }
  }
}

export async function updatePublicLike(taleId: string, sessionId: string) {
  const supabase = await createClient()

  try {
    console.log(`❤️ Updating like for tale ${taleId} with session ${sessionId}`)

    // Use the SECURITY DEFINER RPC function instead of direct updates
    const { data, error } = await supabase.rpc("toggle_anonymous_like", {
      entry_id: taleId,
      session_id: sessionId,
    })

    if (error) {
      console.error("❌ Error toggling like via RPC:", error)
      return { success: false, error: "Failed to update like" }
    }

    if (!data?.success) {
      console.error("❌ RPC returned error:", data?.error)
      return { success: false, error: data?.error || "Failed to update like" }
    }

    const liked = data.liked
    const likeCount = data.like_count

    console.log(`✅ Like updated successfully for tale ${taleId}. New count: ${likeCount}, Liked: ${liked}`)
    return {
      success: true,
      liked,
      likeCount,
    }
  } catch (error) {
    console.error("❌ Error in updatePublicLike:", error)
    return { success: false, error: "Internal server error" }
  }
}
