import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getPublicTales } from "@/lib/supabase/public-server"
import { TalePoster } from "@/components/reels/tale-poster"
import { talePosterUrl } from "@/lib/tale-poster-url"

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
          <p className="mt-0.5 text-sm text-gray-500">Real tales from the Community</p>
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
        {picks.map((t) => {
          const petName = t.pets?.name || "A pet"
          return (
            <Link
              key={t.id}
              href={`/community/public/${t.id}`}
              className="relative block aspect-[4/5] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-gray-200 shadow-sm active:scale-[0.98] sm:w-44"
            >
              <TalePoster tale={{ posterUrl: talePosterUrl(t.id), petName }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{t.title || "A pet tale"}</p>
                <p className="mt-0.5 truncate text-[11px] text-white/75">{petName}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
