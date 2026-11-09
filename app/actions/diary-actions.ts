"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getDiaryEntries() {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "Authentication required", entries: [] }
    }

    const { data: entries, error } = await supabase
      .from("diary_entries")
      .select(`
        *,
        pets (
          id,
          name,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .eq("user_id", user.id)
      .neq("billing_status", "billing_required") // Exclude billing_required entries
      .eq("compression_status", "completed")
      .eq("tts_status", "completed")
      .eq("caption_status", "completed")
      .eq("merged_video_status", "completed")
      .not("merged_video_url", "is", null)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching diary entries:", error)
      return { success: false, error: "Failed to fetch entries", entries: [] }
    }

    return { success: true, entries: entries || [] }
  } catch (error) {
    console.error("Error in getDiaryEntries:", error)
    return { success: false, error: "An unexpected error occurred", entries: [] }
  }
}

export async function getDiaryEntry(entryId: string) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "Authentication required", entry: null }
    }

    // Fetch single diary entry with pet information
    const { data: entry, error } = await supabase
      .from("diary_entries")
      .select(`
        *,
        pets (
          id,
          name,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .eq("id", entryId)
      .eq("user_id", user.id)
      .neq("billing_status", "billing_required") // Exclude billing_required entries
      .single()

    if (error || !entry) {
      console.error("Error fetching diary entry:", error)
      return { success: false, error: "Entry not found", entry: null }
    }

    return { success: true, entry }
  } catch (error) {
    console.error("Error in getDiaryEntry:", error)
    return { success: false, error: "An unexpected error occurred", entry: null }
  }
}

export async function createDiaryEntry(data: {
  title: string
  content?: string
  mood?: string
  pet_id: string
  video_url?: string
  audio_url?: string
  is_public?: boolean
}) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "Authentication required", entry: null }
    }

    // Create diary entry
    const { data: entry, error } = await supabase
      .from("diary_entries")
      .insert({
        ...data,
        user_id: user.id,
        view_count: 0,
        like_count: 0,
        enhancement_status: "pending",
        compression_status: "pending",
        tts_status: "pending",
        caption_status: "pending",
        merged_video_status: "pending",
      })
      .select(`
        *,
        pets (
          id,
          name,
          type,
          avatar_url,
          photo_url,
          image_url
        )
      `)
      .single()

    if (error || !entry) {
      console.error("Error creating diary entry:", error)
      return { success: false, error: "Failed to create entry", entry: null }
    }

    // Revalidate relevant pages
    revalidatePath("/dashboard/reels")
    revalidatePath("/dashboard")

    return { success: true, entry }
  } catch (error) {
    console.error("Error in createDiaryEntry:", error)
    return { success: false, error: "An unexpected error occurred", entry: null }
  }
}

/**
 * Tales from the last 2 hours that are still being made, so "My tales" can show them as
 * "Making…" instead of the tale being invisible until it is done. Failed ones are left out.
 */
export async function getTalesInProgress() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("diary_entries")
      .select("id, title, created_at, compression_status, merged_video_status, billing_status, pets ( name )")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .or("merged_video_status.is.null,merged_video_status.in.(pending,processing)")
      .order("created_at", { ascending: false })
    return (data || [])
      .filter((e: any) => e.compression_status !== "failed" && e.billing_status !== "billing_required")
      .map((e: any) => ({
        id: e.id as string,
        title: (e.title as string) || null,
        createdAt: e.created_at as string,
        petName: (Array.isArray(e.pets) ? e.pets[0]?.name : e.pets?.name) || null,
      }))
  } catch (error) {
    console.error("Error in getTalesInProgress:", error)
    return []
  }
}
