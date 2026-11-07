import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/layout/bottom-nav"
import { PublicFooter } from "@/components/public-footer"
import { PawPrint } from "lucide-react"
import { getSession } from "@/lib/supabase/server"
import { HeroVideoPlayer } from "@/components/hero-video-player"
import { HeroActionButtons } from "@/components/hero-action-buttons"

export const dynamic = "force-dynamic"

export default async function Home() {
  const session = await getSession()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Mobile-optimized header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-teal-600" />
            <span className="text-xl font-bold text-teal-600">Pet Tale</span>
          </Link>
          <nav className="flex gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link href="/dashboard/reels/new">Make a Tale</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/signup">Try Free</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: one promise, one button */}
        <section className="relative px-4 pt-10 pb-12 md:py-20 bg-gradient-to-b from-white to-teal-50/40 dark:from-gray-950 dark:to-teal-950/10">
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-gray-900 dark:text-white">
                Your pet, finally talking.
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto lg:mx-0">
                Upload a clip. In about 3 minutes you get it back narrated in your pet's voice, with captions burned
                in. Ready for Reels, TikTok, or the family group chat.
              </p>

              <HeroActionButtons isLoggedIn={!!session} />

              <p className="text-sm text-gray-500 dark:text-gray-400">
                First tale free · Plans from $4.99 a month · Nothing to download
              </p>
            </div>

            {/* Demo video: shown on every screen size now */}
            <div className="relative hero-video-section max-w-xs sm:max-w-sm mx-auto w-full">
              <HeroVideoPlayer
                src="https://www.pettaleai.com/video/e94325a5-8745-4ee3-b757-5334f2a8497e.mp4"
                poster="https://puxgwsckuwaahdyqwemq.supabase.co/storage/v1/object/public/pet-photo/043ab6db-d66f-4b4a-b327-ddf7220c7e14.jpeg"
                ariaLabel="Russel's Brave Hammock Quest - Demo video"
              />
              <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                Russel · Baby Talk voice · Heartfelt vibe
              </p>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-teal-400/20 rounded-full blur-2xl -z-10" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -z-10" />
            </div>
          </div>
        </section>

        {/* How it works: three steps, no essay */}
        <section className="py-14 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">How it works</h2>
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { emoji: "🎥", title: "Upload a clip", body: "Any video from your phone. Just tell us your pet's name." },
                {
                  emoji: "🎭",
                  title: "Pick a vibe",
                  body: "Comedy, play-by-play, heartfelt and more. Or keep our pick.",
                },
                {
                  emoji: "📲",
                  title: "Post it",
                  body: "Get a vertical video with voice and captions, plus a share link.",
                },
              ].map((step, i) => (
                <li key={step.title} className="text-center space-y-2">
                  <div className="text-4xl">{step.emoji}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Two audiences, one product */}
        <section className="py-14 px-4 bg-teal-50/50 dark:bg-teal-950/10">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-teal-100 dark:border-teal-800 p-6">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">For pet creators</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Turn everyday clips into narrated posts in minutes. Vertical, captioned and made for Reels, TikTok
                and Shorts. Give your pet a signature voice your followers recognize.
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-teal-100 dark:border-teal-800 p-6">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">For pet families</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If you can post to Facebook, you can do this. Text it to family, share it, or keep it as a
                keepsake of who they are.
              </p>
            </div>
          </div>
          <div className="text-center mt-8">
            <Button asChild variant="outline" size="lg" className="h-12 border-2 border-teal-600 text-teal-700 bg-transparent">
              <Link href="/community/public">See more pet tales</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <PublicFooter />

      {/* Bottom Navigation for Mobile */}
      <BottomNav />
    </div>
  )
}
