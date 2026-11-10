import type { Metadata } from "next"
import { Suspense } from "react"
import { getPackOffer } from "@/lib/stripe/pack-offer"
import { getConfiguredPlanIds, priceSummary } from "@/lib/pricing-config"
import PricingClient from "./pricing-client"
import { Spinner } from "@/components/ui/spinner"
import { PublicFooter } from "@/components/public-footer"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const summary = priceSummary(await getPackOffer())
  return {
    title: "Pricing",
    description: `Pet Tale AI pricing - Your first tale is free. ${summary}.`,
    alternates: {
      canonical: "https://www.pettaleai.com/pricing",
    },
    openGraph: {
      title: "Pricing | Pet Tale AI",
      description: `Your first tale is free. ${summary}.`,
    },
  }
}

export default async function PricingPage() {
  // The pack shows when SHOW_CREDIT_PACKS=true, its credit_packs row is active and it has a Stripe
  // price (see lib/stripe/pack-offer.ts)
  const pack = await getPackOffer()
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
        <PricingClient pack={pack} availablePlanIds={availablePlanIds} />
      </Suspense>
      <PublicFooter />
    </div>
  )
}
