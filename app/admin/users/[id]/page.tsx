import { getSession } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import UserDetailView from "./components/user-detail-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getSession()

  if (!session) {
    redirect("/admin/login")
  }

  const supabase = createClient()
  const { data: userData } = await supabase.from("users").select("email, is_admin").eq("id", session.user.id).single()

  if (!userData || !userData.is_admin) {
    redirect("/admin/login")
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">User Details</h1>
          <p className="text-gray-600 mt-1">View and manage user information</p>
        </div>
      </div>

      {/* User Detail View */}
      <UserDetailView userId={id} adminEmail={userData.email} />
    </div>
  )
}
