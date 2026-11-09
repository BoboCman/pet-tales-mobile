import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getPublicTales } from "@/lib/supabase/public-server"
import { talePosterUrl } from "@/lib/tale-poster-url"
import { StripCard } from "@/components/landing/strip-card"

/** Real tales from Community, most loved first. Renders nothing if there are too few to look alive. */
export async function CommunityStrip() {
  let tales: any[] = []
  try {
    tales = await getPublicTales(30)
  } catch {
    return null
  }
  const picks = [...tales].sort((a, b) => (b.like_count || 0) - (a.like_count || 0)).slice(0, 10)
  if (picks.length < 3) return null

  return (
    <section className="py-10">
      <div className="mx-auto flex max-w-4xl items-end justify-between px-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Made by pet families</h2>
          <p className="mt-0.5 text-sm text-gray-500">Tap any tale to watch it</p>
        </div>
        <Link
          href="/community/public"
          className="inline-flex items-center text-sm font-semibold text-teal-700 dark:text-teal-400"
        >
          See all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="scrollbar-hide mx-auto mt-4 flex max-w-4xl snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {picks.map((t) => (
          <StripCard
            key={t.id}
            id={t.id}
            title={t.title || "A pet tale"}
            petName={t.pets?.name || "A pet"}
            posterUrl={talePosterUrl(t.id)}
            videoUrl={t.merged_video_url || t.optimized_video_url || t.video_url || null}
          />
        ))}
      </div>
    </section>
  )
}
