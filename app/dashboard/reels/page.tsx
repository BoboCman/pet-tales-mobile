import Link from "next/link"
import { Plus, Video } from "lucide-react"
import { getDiaryEntries, getTalesInProgress } from "@/app/actions/diary-actions"
import { TalesGallery, type GalleryTale } from "@/components/reels/tales-gallery"

export const dynamic = "force-dynamic"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

function toGalleryTale(e: any): GalleryTale {
  const pet = Array.isArray(e.pets) ? e.pets[0] : e.pets
  const petImage = [pet?.avatar_url, pet?.photo_url, pet?.image_url].find(
    (u: unknown) => typeof u === "string" && u.startsWith("http"),
  )
  return {
    id: e.id,
    title: e.title || "Untitled tale",
    mood: e.mood || null,
    createdAt: e.created_at,
    isPublic: !!e.is_public,
    views: e.view_count ?? 0,
    likes: e.like_count ?? 0,
    petId: pet?.id ?? e.pet_id ?? null,
    petName: pet?.name || e.pet_name || "Your pet",
    petImage: petImage ?? null,
    videoUrl: e.merged_video_supabase_url || e.merged_video_url || null,
    // Poster frame saved by the merge step (newer tales); the card falls back to the video's first frame
    posterUrl: SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/videos/thumbnails/pet-tale-${e.id}.jpg` : null,
  }
}

export default async function ReelsPage() {
  const [result, inProgress] = await Promise.all([getDiaryEntries(), getTalesInProgress()])

  if (!result.success) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-red-600">We couldn&apos;t load your tales. Please refresh the page.</p>
      </div>
    )
  }

  const tales = (result.entries || []).map(toGalleryTale)

  if (tales.length === 0 && inProgress.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-50 dark:bg-teal-900/30">
          <Video className="h-10 w-10 text-teal-600" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your first tale awaits</h1>
        <p className="mt-2 max-w-xs text-gray-500">
          Pick a clip of your pet and we&apos;ll give them a voice and a story in about 2 minutes.
        </p>
        <Link
          href="/dashboard/reels/new"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-teal-600 px-6 font-semibold text-white shadow-sm active:bg-teal-700"
        >
          <Plus className="h-5 w-5" />
          Make a tale
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-white dark:bg-gray-950">
      <TalesGallery tales={tales} inProgress={inProgress} />
    </div>
  )
}
