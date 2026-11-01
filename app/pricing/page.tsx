import type { Metadata } from "next"
import { Suspense } from "react"
import { getAllPacks } from "@/lib/stripe/pack-config"
import PricingClient from "./pricing-client"
import { Spinner } from "@/components/ui/spinner"
import { PublicFooter } from "@/components/public-footer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pet Tale AI pricing - Start free with 3 tales, get 1 free tale every week. Credit packs from $4.99. No subscription required, credits never expire.",
  alternates: {
    canonical: "https://www.pettaleai.com/pricing",
  },
  openGraph: {
    title: "Pricing | Pet Tale AI",
    description:
      "Start free with 3 tales, get 1 free tale every week. Credit packs from $4.99. No subscription required.",
  },
}

export default async function PricingPage() {
  const packs = await getAllPacks()

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-emerald-50 to-blue-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Spinner className="size-8" />
          </div>
        }
      >
        <PricingClient packs={packs} />
      </Suspense>
      <PublicFooter />
    </div>
  )
}
