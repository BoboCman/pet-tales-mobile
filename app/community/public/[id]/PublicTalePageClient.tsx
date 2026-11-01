"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicTaleViewer } from "../components/PublicTaleViewer"
import { useMobile } from "@/hooks/use-mobile"

interface PublicTale {
  id: string
  title: string | null
  content: string | null
  mood: string | null
  image_url: string | null
  video_url: string | null
  optimized_video_url: string | null
  merged_video_url: string | null
  created_at: string
  view_count: number | null
  like_count: number | null
  pets: {
    id: string
    name: string
    breed: string | null
    type: string | null
    avatar_url: string | null
    photo_url: string | null
    image_url: string | null
  } | null
}

interface PublicTalePageClientProps {
  tale: PublicTale
  taleId: string
}

export function PublicTalePageClient({ tale, taleId }: PublicTalePageClientProps) {
  const router = useRouter()
  const isMobile = useMobile()

  if (isMobile) {
    return <PublicTaleViewer tale={tale} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">{tale.title || "Pet Tale"}</h1>
              <p className="text-sm text-gray-600">{tale.pets?.name || "Unknown Pet"}'s Tale</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Desktop */}
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <PublicTaleViewer tale={tale} />
      </div>
    </div>
  )
}
