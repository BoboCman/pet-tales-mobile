"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteReel(reelId: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "Authentication required" }
    }

    // Delete the reel (only if it belongs to the user)
    const { error } = await supabase.from("diary_entries").delete().eq("id", reelId).eq("user_id", user.id)

    if (error) {
      console.error("Error deleting reel:", error)
      return { success: false, error: "Failed to delete reel" }
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/reels")
    revalidatePath("/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error in deleteReel:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function togglePublicStatus(reelId: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "Authentication required" }
    }

    // First, get the current status
    const { data: currentReel, error: fetchError } = await supabase
      .from("diary_entries")
      .select("is_public")
      .eq("id", reelId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !currentReel) {
      console.error("Error fetching reel:", fetchError)
      return { success: false, error: "Reel not found" }
    }

    // Toggle the public status
    const newPublicStatus = !currentReel.is_public

    // Update the reel
    const { error: updateError } = await supabase
      .from("diary_entries")
      .update({ is_public: newPublicStatus })
      .eq("id", reelId)
      .eq("user_id", user.id)

    if (updateError) {
      console.error("Error updating reel public status:", updateError)
      return { success: false, error: "Failed to update sharing status" }
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/reels")
    revalidatePath("/dashboard")
    revalidatePath("/community/public")

    return {
      success: true,
      isPublic: newPublicStatus,
      message: newPublicStatus ? "Tale shared to community successfully!" : "Tale removed from community",
    }
  } catch (error) {
    console.error("Error in togglePublicStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
