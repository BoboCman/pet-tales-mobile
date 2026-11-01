import { getSession } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminVideosPage from "./components/admin-videos-page"

export const dynamic = "force-dynamic"

export default async function VideosPage() {
  const session = await getSession()
  if (!session) {
    redirect("/admin/login")
  }

  const supabase = createClient()
  const { data: userData } = await supabase.from("users").select("is_admin").eq("id", session.user.id).single()

  if (!userData || !userData.is_admin) {
    redirect("/admin/login")
  }

  return <AdminVideosPage />
}
