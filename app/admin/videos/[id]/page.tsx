import { getSession } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminVideoDetailView from "./components/admin-video-detail-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface PageProps {
  params: {
    id: string
  }
}

export default async function AdminVideoDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) {
    redirect("/admin/login")
  }

  const supabase = createClient()
  const { data: userData } = await supabase.from("users").select("is_admin").eq("id", session.user.id).single()

  if (!userData || !userData.is_admin) {
    redirect("/admin/login")
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/videos">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Video Details</h1>
          <p className="text-gray-600 mt-1">View and manage video</p>
        </div>
      </div>

      {/* Video Detail View */}
      <AdminVideoDetailView videoId={params.id} />
    </div>
  )
}
