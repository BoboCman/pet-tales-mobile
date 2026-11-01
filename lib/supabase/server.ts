import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

export const createClient = () => {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )
}

// Helper functions for server components
export async function getSession() {
  const supabase = createClient()
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

export async function getUser() {
  const supabase = createClient()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

/**
 * @deprecated  Use `getUser()` instead.
 * Exported only for backwards-compatibility with code that still imports
 * `getUserDetails` (e.g. dashboard pages).  Internally it forwards to `getUser`.
 */
export async function getUserDetails() {
  return getUser()
}

// Pet-related functions
export async function getPets() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return []
  }

  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching pets:", error)
    return []
  }

  return data || []
}

export async function getPetById(id: string) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data, error } = await supabase.from("pets").select("*").eq("id", id).eq("user_id", session.user.id).single()

  if (error) {
    console.error("Error fetching pet:", error)
    return null
  }

  return data
}

export async function getDiaryEntries(petId?: string) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return []
  }

  let query = supabase
    .from("diary_entries")
    .select(`
      *,
      pets (
        id,
        name,
        species,
        breed,
        image_url
      )
    `)
    .eq("user_id", session.user.id)
    .neq("billing_status", "billing_required") // Exclude billing_required entries
    .order("created_at", { ascending: false })

  if (petId) {
    query = query.eq("pet_id", petId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching diary entries:", error)
    return []
  }

  return data || []
}

export async function getPublicDiaryEntries(limit = 20) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("diary_entries")
    .select(`
      *,
      pets (
        id,
        name,
        species,
        breed,
        image_url
      )
    `)
    .eq("is_public", true) // Add is_public filter
    .not("merged_video_url", "is", null)
    .neq("billing_status", "billing_required") // Exclude billing_required entries
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching public diary entries:", error)
    return []
  }

  return data || []
}
