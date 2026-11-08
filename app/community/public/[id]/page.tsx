import { notFound } from "next/navigation"
import { getPublicTaleById } from "@/lib/supabase/public-server"
import { PublicTalePageClient } from "./PublicTalePageClient"
import type { Metadata } from "next"
import { getShareableTale, taleMetadata } from "@/lib/share/tale-share"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tale = await getShareableTale(params.id)
  if (!tale || !tale.isPublic) return { title: "Pet tale" }
  return taleMetadata(tale, `/community/public/${tale.id}`)
}

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
