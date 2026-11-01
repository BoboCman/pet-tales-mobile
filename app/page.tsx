import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
                <Link href="/dashboard/pets">My Pets</Link>
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
        <section className="relative flex items-center justify-center px-4 py-12 md:py-20 lg:py-24 bg-gradient-to-b from-white to-teal-50/30 dark:from-gray-950 dark:to-teal-950/10">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column: Text Content */}
              <div className="space-y-8 text-center lg:text-left">
                {/* Pet emoji decoration - only on mobile */}
                <div className="flex gap-2 text-3xl justify-center lg:hidden animate-bounce">
                  <span className="animate-pulse">🐶</span>
                  <span className="animate-bounce delay-100">🎤</span>
                  <span className="animate-pulse delay-200">🐱</span>
                </div>

                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                    <span className="block text-gray-900 dark:text-white">Upload a Pet Video, get video and captions back.</span>
                  </h1>
                  <p className="text-lg sm:text-xl font-medium text-teal-600 dark:text-teal-400 mt-4">
                    If you can post to Facebook, you can do this.
                  </p>
                  <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-2">
                    Pick a voice. Pick a vibe. In about 3 minutes, your pet narrates what's happening — with voice and captions burned in. Ready to share.
                  </p>
                </div>

                <HeroActionButtons isLoggedIn={!!session} />

                <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <span className="text-green-500">✓</span>
                    <span>Ready in about 3 minutes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-green-500">✓</span>
                    <span>3 free tales when you join</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-green-500">✓</span>
                    <span>No app to download</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual/Demo - Hidden on mobile */}
              <div className="relative lg:block hidden hero-video-section">
                <div className="mb-4 text-center">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Russel's Brave Hammock Quest</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    His owner picked a Baby Talk voice and a Heartfelt tone — and we turned Russel's careful hammock
                    test into a whole little adventure.
                  </p>
                </div>

                <HeroVideoPlayer
                  src="https://www.pettaleai.com/video/e94325a5-8745-4ee3-b757-5334f2a8497e.mp4"
                  poster="https://puxgwsckuwaahdyqwemq.supabase.co/storage/v1/object/public/pet-photo/043ab6db-d66f-4b4a-b327-ddf7220c7e14.jpeg"
                  ariaLabel="Russel's Brave Hammock Quest - Demo video"
                />

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-teal-400/20 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-white dark:bg-gray-900">
          <div className="container max-w-md lg:max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-teal-200 dark:border-teal-700 p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
              <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white text-center">
                What Makes It Special
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">📝</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      They Narrate What They're Actually Doing
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      We follow the moment as it unfolds — the jumps, the chases, the curious pauses — and turn it into
                      a story told from your pet's point of view. It doesn't feel scripted, because it's based on what's
                      really happening in your video.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">🎤</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      Pick a Voice That Fits Their Personality
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Choose the voice that sounds like your pet. You'll know it when you hear it.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">🐾</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Unique to Your Pet</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Add their name and a little about their personality. It helps the story feel unmistakably like
                      them — so it becomes a real keepsake, not something generic.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">🎥</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Upload Your Video</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Choose a voice, then upload a video from your phone. We turn what's happening in that moment into
                      a story from your pet's point of view.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">🔗</div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Share It or Save It</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get the finished video with voice and captions, plus one simple link. Text it to family, post it
                      on Facebook, or save it as a keepsake.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-gradient-to-b from-white to-teal-50 dark:from-background dark:to-teal-900/20">
          <div className="container max-w-md lg:max-w-4xl mx-auto">
            <Card className="overflow-hidden border-teal-100 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-950/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-10">
                <div className="flex flex-col items-center text-center space-y-6">
                  <h2 className="text-2xl font-bold tracking-tighter text-teal-700 dark:text-teal-300 flex items-center gap-2">
                    🎬 See What Families Are Sharing
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    Real pets. Real moments. Their stories — told by them.
                  </p>
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-teal-600 hover:bg-teal-50 h-16 min-w-[240px] text-xl font-bold transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Link href="/community/public">See More Pet Tales</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 px-4 bg-teal-600 text-white">
          <div className="container max-w-md lg:max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-8">
              <h2 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
                Ready to Let Your Pet Tell Their Story?
              </h2>
              <p className="text-teal-100 text-lg">
                They've got a lot to say.
                <br />
                Let's turn your favorite moment into a keepsake.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-white text-teal-600 hover:bg-teal-50 h-16 min-w-[240px] text-xl font-bold transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Link href={session ? "/dashboard/pets/new" : "/auth/signup"}>Try It Free</Link>
              </Button>
            </div>
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
