import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PawPrint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getShareableTale, taleMetadata } from "@/lib/share/tale-share"

export const dynamic = "force-dynamic"

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tale = await getShareableTale(params.id)
  if (!tale) return { title: "Tale not found", robots: { index: false } }
  return taleMetadata(tale, `/tale/${tale.id}`)
}

/**
 * The page a shared tale link opens: the video first, then one button to make your own.
 * This is where every share turns into a sign-up.
 */
export default async function SharedTalePage({ params }: Props) {
  const tale = await getShareableTale(params.id)
  if (!tale) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-teal-50/60 dark:from-gray-950 dark:to-teal-950/20 pb-28 md:pb-12">
      <header className="flex items-center justify-between px-4 h-14 max-w-md mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <PawPrint className="h-6 w-6 text-teal-600" />
          <span className="text-lg font-bold text-teal-600">Pet Tale</span>
        </Link>
        <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
          <Link href="/auth/signup?ref=shared_tale">Try free</Link>
        </Button>
      </header>

      <main className="px-4 max-w-md mx-auto space-y-5">
        <div className="rounded-2xl overflow-hidden bg-black shadow-lg aspect-[9/16]">
          <video
            src={tale.videoUrl}
            poster={tale.posterUrl ?? undefined}
            controls
            playsInline
            autoPlay
            muted
            loop
            preload="metadata"
            className="w-full h-full object-contain"
          />
        </div>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">Tap the video for sound</p>

        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tale.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Starring {tale.petName}</p>
        </div>

        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-teal-100 dark:border-teal-900 p-5 text-center space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Give your pet a voice too</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload any clip from your phone. In about 3 minutes it comes back narrated, with captions, ready to post.
          </p>
          <Button asChild size="lg" className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700">
            <Link href="/auth/signup?ref=shared_tale">Make your first tale free</Link>
          </Button>
          <p className="text-xs text-gray-500">No credit card needed</p>
        </section>
      </main>
    </div>
  )
}
