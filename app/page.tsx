import Link from "next/link"
import { Clapperboard, Heart, PawPrint, Sparkles } from "lucide-react"
import { PublicFooter } from "@/components/public-footer"
import { getSession } from "@/lib/supabase/server"
import { HeroVideoPlayer } from "@/components/hero-video-player"
import { CommunityStrip } from "@/components/landing/community-strip"
import { NARRATION_GENRES } from "@/lib/narration-genres"
import { UNIVERSAL_VOICES } from "@/lib/voice-personalities"
import { VoicesVibesSheet } from "@/components/landing/voices-vibes-sheet"
import { getPackOffer } from "@/lib/stripe/pack-offer"
import { cheapestPlan, packLabel, plansFromLabel, priceSummary } from "@/lib/pricing-config"

// Only what the sheet shows (keeps provider voice ids out of the page)
const SHEET_VOICES = UNIVERSAL_VOICES.map(({ value, emoji, label, description }) => ({
  value,
  emoji,
  label,
  description,
}))
const SHEET_VIBES = NARRATION_GENRES.map(({ value, emoji, label, description }) => ({
  value,
  emoji,
  label,
  description,
}))

export const dynamic = "force-dynamic"

const FAQ = [
  {
    q: "Is the first tale really free?",
    a: "Yes. Sign up with your email and your first tale is on us. No credit card needed.",
  },
  {
    q: "What clips work best?",
    a: "Vertical clips under a minute, up to 75MB. Most phone videos of 15 to 45 seconds are perfect.",
  },
  {
    q: "Who can see my tales?",
    a: "You decide for each tale: keep it to yourself, send the link to family, or post it to Community.",
  },
]

export default async function Home() {
  const session = await getSession()
  const ctaHref = session ? "/dashboard/reels/new" : "/auth/signup?ref=landing"
  const ctaLabel = session ? "Make a tale" : "Make your first tale free"
  // Prices come from one place (lib/pricing-config + lib/stripe/pack-offer), so the pack shows here
  // exactly when it can be bought
  const pack = await getPackOffer()
  const priceLine = pack
    ? `Then ${priceSummary(pack).charAt(0).toLowerCase()}${priceSummary(pack).slice(1)}`
    : `${priceSummary(null)} · Nothing to download`
  const faq = [
    ...FAQ,
    {
      q: "What does it cost after that?",
      a: pack
        ? `Get ${packLabel(pack)}, one time with no subscription, or a plan from ${plansFromLabel} for ${cheapestPlan.talesPerMonth} tales. Pack tales never expire, and you can cancel a plan anytime in Settings.`
        : `Plans start at ${plansFromLabel} for ${cheapestPlan.talesPerMonth} tales. Cancel anytime in Settings.`,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-950/90">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-teal-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">Pet Tale</span>
          </Link>
          <nav className="flex items-center gap-1">
            {session ? (
              <Link
                href="/dashboard/reels/new"
                className="inline-flex h-9 items-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white"
              >
                Make a tale
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex h-9 items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup?ref=landing_header"
                  className="inline-flex h-9 items-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white"
                >
                  Try free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: one promise, one button, the proof right under it */}
        <section className="bg-gradient-to-b from-teal-50/60 to-white px-4 pb-6 pt-8 md:py-20 dark:from-teal-950/20 dark:to-gray-950">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow-sm ring-1 ring-teal-100 dark:bg-gray-900 dark:text-teal-300 dark:ring-teal-900">
                <Sparkles className="h-3.5 w-3.5" />
                First tale free · no card needed
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
                What was your pet thinking?
              </h1>
              <p className="mx-auto mt-4 max-w-md text-lg text-gray-600 lg:mx-0 dark:text-gray-400">
                Pet Tale watches your clip and turns every moment into your pet&apos;s own story, narrated and
                captioned, ready to post in minutes.
              </p>
              <Link
                href={ctaHref}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-teal-600 px-10 text-lg font-semibold text-white shadow-lg shadow-teal-600/20 active:bg-teal-700 sm:w-auto"
              >
                {ctaLabel}
              </Link>
              <p className="mt-3 text-sm text-gray-500">{priceLine}</p>
            </div>

            <div className="mx-auto w-full max-w-[260px] sm:max-w-xs">
              <HeroVideoPlayer
                src="https://www.pettaleai.com/video/e94325a5-8745-4ee3-b757-5334f2a8497e.mp4"
                poster="https://puxgwsckuwaahdyqwemq.supabase.co/storage/v1/object/public/pet-photo/043ab6db-d66f-4b4a-b327-ddf7220c7e14.jpeg"
                ariaLabel="Russel's Brave Hammock Quest - Demo video"
              />
              <p className="mt-3 text-center text-sm text-gray-500">Russel · Baby Talk voice · Heartfelt vibe</p>
            </div>
          </div>
        </section>

        {/* Real examples beat any description */}
        <CommunityStrip />

        {/* How it works */}
        <section className="bg-gray-50 px-4 py-12 dark:bg-gray-900/50">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">How it works</h2>
            <ol className="mt-6 space-y-3">
              <li className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">We watch every moment</h3>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    Upload any clip from your phone. Our AI picks out what happens: the pounce, the side-eye, the
                    zoomies.
                  </p>
                </div>
              </li>
              <li className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
                  2
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Your pet tells the story</h3>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    What they were thinking, written to follow the action. Pick from 12 voices and 6 vibes, or keep
                    ours.
                  </p>
                  <VoicesVibesSheet voices={SHEET_VOICES} vibes={SHEET_VIBES} />
                </div>
              </li>
              <li className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white">
                  3
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Share it with everyone</h3>
                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    Post it to TikTok, Instagram or Facebook, or text it to family and friends. It plays on any phone.
                  </p>
                </div>
              </li>
            </ol>
            <p className="mt-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
              The script, voiceover, captions and edit, done for you.
            </p>

            {/* What makes it theirs */}
            <div className="mt-3 flex gap-4 rounded-2xl bg-gradient-to-r from-amber-50 to-teal-50 p-4 ring-1 ring-amber-100 dark:from-amber-900/20 dark:to-teal-900/20 dark:ring-amber-900/40">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-500 dark:bg-gray-900">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Sounds like them, not a robot</h3>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  Six quick taps about their energy, attitude and quirks, and every tale is told the way your pet would
                  tell it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Two audiences, one product */}
        <section className="px-4 py-12">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex gap-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                <Clapperboard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">For pet creators</h3>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Skip writing scripts and recording voiceovers. Narrated, captioned posts for Reels, TikTok and Shorts
                  in minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                <Heart className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">For pet families</h3>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  If you can post to Facebook, you can do this. Text it to family or keep it as a keepsake.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick answers to the questions that stop people at sign-up */}
        <section className="px-4 pb-12">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Good to know</h2>
            <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
              {faq.map((item) => (
                <details key={item.q} className="group px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-medium text-gray-900 dark:text-white">
                    {item.q}
                    <span className="text-xl leading-none text-teal-600 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-2 text-sm text-gray-600 dark:text-gray-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action: visitors who scroll this far are deciding */}
        <section className="bg-gradient-to-b from-white to-teal-50/70 px-4 pb-16 pt-4 text-center dark:from-gray-950 dark:to-teal-950/20">
          <div className="mx-auto max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">What would your pet say?</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Find out in a few minutes.</p>
            <Link
              href={session ? "/dashboard/reels/new" : "/auth/signup?ref=landing_bottom"}
              className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-teal-600 text-lg font-semibold text-white shadow-lg shadow-teal-600/20 active:bg-teal-700"
            >
              {ctaLabel}
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
