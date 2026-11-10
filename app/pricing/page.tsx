import type { Metadata } from "next"
import { Suspense } from "react"
import { getAllPacks, getPackPriceId, packsEnabled } from "@/lib/stripe/pack-config"
import { getConfiguredPlanIds } from "@/lib/pricing-config"
import PricingClient from "./pricing-client"
import { Spinner } from "@/components/ui/spinner"
import { PublicFooter } from "@/components/public-footer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pet Tale AI pricing - Your first tale is free. Plans from $4.99 a month for 10 tales.",
  alternates: {
    canonical: "https://www.pettaleai.com/pricing",
  },
  openGraph: {
    title: "Pricing | Pet Tale AI",
    description:
      "Your first tale is free. Plans from $4.99 a month.",
  },
}

export default async function PricingPage() {
  // One-time packs show once SHOW_CREDIT_PACKS=true and the pack has a Stripe price
  // (STRIPE_PACK_TRY_PACK_PRICE_ID in Vercel, or credit_packs.stripe_price_id)
  const packs = packsEnabled() ? (await getAllPacks()).filter((p) => getPackPriceId(p)) : []
  const availablePlanIds = getConfiguredPlanIds()

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-emerald-50 to-blue-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Spinner className="size-8" />
          </div>
        }
      >
        <PricingClient packs={packs} availablePlanIds={availablePlanIds} />
      </Suspense>
      <PublicFooter />
    </div>
  )
}
