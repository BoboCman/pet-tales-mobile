import { getSession } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminUsersPage from "./components/admin-users-page"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const session = await getSession()
  if (!session) {
    redirect("/admin/login")
  }

  const supabase = createClient()
  const { data: userData } = await supabase.from("users").select("is_admin").eq("id", session.user.id).single()

  if (!userData || !userData.is_admin) {
    redirect("/admin/login")
  }

  return <AdminUsersPage />
}
