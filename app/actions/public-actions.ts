"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export async function incrementPublicViewCount(entryId: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )

    const { data: entry, error: fetchError } = await supabase
      .from("diary_entries")
      .select("view_count")
      .eq("id", entryId)
      .eq("is_public", true)
      .neq("billing_status", "billing_required") // Exclude billing_required entries
      .single()

    if (fetchError) {
      console.error("Error fetching entry for view count:", fetchError)
      return { success: false, error: "Entry not found" }
    }

    const currentViewCount = entry.view_count || 0
    const newViewCount = currentViewCount + 1

    const { error: updateError } = await supabase
      .from("diary_entries")
      .update({
        view_count: newViewCount,
      })
      .eq("id", entryId)
      .eq("is_public", true)
      .neq("billing_status", "billing_required") // Exclude billing_required entries

    if (updateError) {
      console.error("Error updating view count:", updateError)
      return { success: false, error: "Failed to update view count" }
    }

    return { success: true, viewCount: newViewCount }
  } catch (error) {
    console.error("Error in incrementPublicViewCount:", error)
    return { success: false, error: "Server error" }
  }
}
