import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

// Defensive environment variable access with runtime validation
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error("CRITICAL: Missing SUPABASE_URL environment variable. Check Vercel settings.")
}

if (!supabaseServiceKey) {
  throw new Error("CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Check Vercel settings.")
}

// Log initialization info for debugging (safe - doesn't expose secrets)
console.log("🔐 Initializing supabaseAdmin with service role key")
console.log("📍 Supabase URL:", supabaseUrl.substring(0, 30) + "...")
console.log("🔑 Service role key present:", !!supabaseServiceKey)
console.log("🔑 Service role key length:", supabaseServiceKey.length)

// Create Supabase admin client that bypasses RLS
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

console.log("✅ supabaseAdmin client initialized successfully")

// Helper function to create diary entry bypassing RLS
export async function createDiaryEntryBypassRLS(entryData: any) {
  try {
    const { data, error } = await supabaseAdmin.from("diary_entries").insert(entryData).select().single()

    if (error) {
      console.error("❌ Error creating diary entry:", error)
      throw error
    }

    console.log("✅ Diary entry created successfully:", data.id)
    return { data, error: null }
  } catch (error) {
    console.error("❌ Failed to create diary entry:", error)
    return { data: null, error }
  }
}

// Helper function to update diary entry bypassing RLS
export async function updateDiaryEntryBypassRLS(entryId: string, updates: any) {
  try {
    const { data, error } = await supabaseAdmin
      .from("diary_entries")
      .update(updates)
      .eq("id", entryId)
      .select()
      .single()

    if (error) {
      console.error("❌ Error updating diary entry:", error)
      throw error
    }

    console.log("✅ Diary entry updated successfully:", data.id)
    return { data, error: null }
  } catch (error) {
    console.error("❌ Failed to update diary entry:", error)
    return { data: null, error }
  }
}

// Helper function to fetch diary entry bypassing RLS
export async function fetchDiaryEntryBypassRLS(entryId: string) {
  try {
    const { data, error } = await supabaseAdmin.from("diary_entries").select("*").eq("id", entryId).single()

    if (error) {
      console.error("❌ Error fetching diary entry:", error)
      throw error
    }

    return { data, error: null }
  } catch (error) {
    console.error("❌ Failed to fetch diary entry:", error)
    return { data: null, error }
  }
}
