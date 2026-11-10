import { CreditManagementCard } from "./components/credit-management-card"
import DashboardMetrics from "./components/dashboard-metrics"
import { StorageCleanupCard } from "./components/storage-cleanup-card"
import { OnSaleCard } from "./components/on-sale-card"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Users, Video } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/admin/login")
  }

  const supabase = createClient()
  const { data: userData } = await supabase.from("users").select("email").eq("id", session.user.id).single()

  if (!userData) {
    redirect("/admin/login")
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users and credits</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/users">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Users className="h-4 w-4" />
              View All Users
            </Button>
          </Link>
          <Link href="/admin/videos">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Video className="h-4 w-4" />
              View All Videos
            </Button>
          </Link>
        </div>
      </div>

      <DashboardMetrics />

      <OnSaleCard />

      <CreditManagementCard adminEmail={userData.email} />

      <StorageCleanupCard />
    </div>
  )
}
