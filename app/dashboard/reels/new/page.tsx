import { redirect } from "next/navigation"
import { getPets, getSession } from "@/lib/supabase/server"
import { VideoUploadInterface } from "@/components/reels/video-upload-interface"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface NewReelPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function NewReelPage({ searchParams }: NewReelPageProps) {
  // Check authentication
  const session = await getSession()
  if (!session) {
    redirect("/auth/login?redirectTo=/dashboard/reels/new")
  }

  // Get user's pets
  const pets = await getPets()

  // No pets yet is fine: the upload screen asks for just a name, dog/cat and
  // boy/girl right before creating the tale.
  const preSelectedPetId = searchParams?.pet as string | undefined
  const selectedPetId =
    preSelectedPetId && pets.find((p) => p.id === preSelectedPetId) ? preSelectedPetId : pets[0]?.id || ""

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/reels">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Create Pet Tale</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-md mx-auto px-4 py-5">
        <VideoUploadInterface pets={pets} selectedPetId={selectedPetId} />
      </div>
    </div>
  )
}
