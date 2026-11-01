import { createClient } from "@/lib/supabase/server"

/**
 * Check if a user is an admin
 * @param userId - The user's UUID
 * @returns boolean indicating admin status
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: user } = await supabase.from("users").select("is_admin").eq("id", userId).single()

  return user?.is_admin ?? false
}

/**
 * Require admin access - throws if not admin
 * @param userId - The user's UUID
 * @throws Error if user is not an admin
 */
export async function requireAdmin(userId: string): Promise<void> {
  const admin = await isAdmin(userId)

  if (!admin) {
    throw new Error("Unauthorized: Admin access required")
  }
}

/**
 * Get admin user data
 * @param userId - The user's UUID
 * @returns User object if admin, null otherwise
 */
export async function getAdminUser(userId: string) {
  const supabase = createClient()

  const { data: user } = await supabase.from("users").select("id, email, is_admin").eq("id", userId).single()

  if (!user?.is_admin) {
    return null
  }

  return user
}

/**
 * Get all admin users
 * @returns Array of admin users
 */
export async function getAllAdmins() {
  const supabase = createClient()

  const { data: admins } = await supabase
    .from("users")
    .select("id, email, created_at")
    .eq("is_admin", true)
    .order("created_at", { ascending: false })

  return admins ?? []
}
