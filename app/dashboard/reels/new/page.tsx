import { redirect } from "next/navigation"
import { getPets, getSession } from "@/lib/supabase/server"
import { VideoUploadInterface } from "@/components/reels/video-upload-interface"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CreditsBadge } from "@/components/ui/credits-badge"

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
      {/* One slim top bar on phones: back, title, tales left (replaces the app header here) */}
      <div className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-2">
          <Link
            href="/dashboard/reels"
            aria-label="Back to my tales"
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold text-gray-900">New tale</h1>
          <div className="flex justify-end pr-1">
            <CreditsBadge />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-md mx-auto px-4 pt-4 pb-5">
        <VideoUploadInterface pets={pets} selectedPetId={selectedPetId} />
      </div>
    </div>
  )
}
