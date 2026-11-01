import { notFound } from "next/navigation"
import { getPublicTaleById } from "@/lib/supabase/public-server"
import { PublicTalePageClient } from "./PublicTalePageClient"

interface PageProps {
  params: { id: string }
}

export default async function PublicTalePage({ params }: PageProps) {
  const taleId = params.id

  try {
    const tale = await getPublicTaleById(taleId)

    if (!tale) {
      notFound()
    }

    // Ensure the tale has video content
    if (!tale.merged_video_url) {
      notFound()
    }

    return <PublicTalePageClient tale={tale} taleId={taleId} />
  } catch (error) {
    console.error("Error fetching tale:", error)
    notFound()
  }
}
