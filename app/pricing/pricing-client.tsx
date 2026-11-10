"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check, Coins, Heart, Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { isStripeTestMode } from "@/lib/stripe/test-mode"
import { formatUsd, subscriptionPlans, type PackOffer, type PlanId } from "@/lib/pricing-config"

interface PricingClientProps {
  /** The one-time pack on sale, or null (lib/stripe/pack-offer.ts) */
  pack: PackOffer | null
  /** Plans with a Stripe price configured; others show as "Coming soon" */
  availablePlanIds: PlanId[]
}

/** One way to buy tales: the one-time pack or a monthly plan */
interface PricingOption {
  id: string
  kind: "pack" | "plan"
  name: string
  tagline: string
  price: string
  /** "once" or "a month" */
  cadence: string
  /** Short line under the name in the phone list */
  summary: string
  badge?: string
  highlight?: string
  features: string[]
  cta: string
  reassurance: string
  available: boolean
  icon: typeof Coins
}

const petParent = subscriptionPlans.find((p) => p.id === "pet_parent")
const superFan = subscriptionPlans.find((p) => p.id === "super_fan")

/** Super Fan vs Pet Parent: how many more tales, and how much less each one costs */
function superFanDeal() {
  if (!petParent || !superFan) return null
  const times = superFan.talesPerMonth / petParent.talesPerMonth
  const perTaleSaving =
    1 - superFan.monthlyPrice / superFan.talesPerMonth / (petParent.monthlyPrice / petParent.talesPerMonth)
  const pct = Math.round(perTaleSaving * 100)
  if (pct <= 0) return null
  const timesLabel = Number.isInteger(times) ? `${times}×` : `${times.toFixed(1)}×`
  return { pct, timesLabel }
}

function buildOptions(pack: PackOffer | null, availablePlanIds: PlanId[]): PricingOption[] {
  const options: PricingOption[] = []
  const deal = superFanDeal()

  if (pack) {
    options.push({
      id: pack.id,
      kind: "pack",
      name: "Try pack",
      tagline: "A few more tales, no strings attached",
      price: formatUsd(pack.priceCents),
      cadence: "once",
      summary: `${pack.tales} tales, one time`,
      features: [
        `${pack.tales} tales to use whenever you like`,
        "Pack tales never expire",
        "All narrator voices and vibes",
        "No subscription, nothing to cancel",
      ],
      cta: `Get ${pack.tales} tales for ${formatUsd(pack.priceCents)}`,
      reassurance: "One payment. Nothing renews.",
      available: true,
      icon: Coins,
    })
  }

  for (const plan of subscriptionPlans) {
    const isSuperFan = plan.id === "super_fan"
    options.push({
      id: plan.id,
      kind: "plan",
      name: plan.name,
      tagline: plan.description,
      price: `$${plan.monthlyPrice.toFixed(2)}`,
      cadence: "a month",
      summary: `${plan.talesPerMonth} tales every month`,
      badge: isSuperFan && deal ? `Save ${deal.pct}%` : undefined,
      highlight:
        isSuperFan && deal && petParent
          ? `${deal.timesLabel} the tales of ${petParent.name}, so you save ${deal.pct}% on every tale.`
          : undefined,
      features: plan.features,
      cta: `Get ${plan.name}`,
      reassurance: "Renews monthly. Cancel anytime in Settings.",
      available: availablePlanIds.includes(plan.id),
      icon: isSuperFan ? Heart : Sparkles,
    })
  }

  return options
}

export default function PricingClient({ pack, availablePlanIds }: PricingClientProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const options = buildOptions(pack, availablePlanIds)
  const featuredId = subscriptionPlans.find((p) => p.popular)?.id ?? options[0]?.id
  const [selectedId, setSelectedId] = useState<string>(featuredId)
  const selected = options.find((o) => o.id === selectedId) ?? options[0]

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (!sessionId) return

    if (searchParams.get("pack_purchase") === "success") {
      toast({
        title: "🎉 Tales added!",
        description: "Your pack tales will be in your account within a minute. They never expire.",
        duration: 6000,
      })
      window.history.replaceState({}, "", "/pricing")
    } else if (searchParams.get("subscribed") === "true") {
      toast({
        title: "🎉 You're subscribed!",
        description: "Your plan's tales will appear in your account within a minute.",
        duration: 6000,
      })
      window.history.replaceState({}, "", "/pricing")
    }
  }, [searchParams, toast])

  const startCheckout = async (id: string, endpoint: string, body: Record<string, string>) => {
    setBusyId(id)
    toast({ title: "Redirecting to checkout...", description: "Please wait while we prepare your checkout." })

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        window.location.href = `/auth/signup?redirect=${encodeURIComponent("/pricing")}`
        return
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast({
          title: "Checkout failed",
          description: error.message || "Failed to start checkout",
          variant: "destructive",
        })
        setBusyId(null)
        return
      }

      const data = await res.json()
      window.location.href = data.url
    } catch (error) {
      console.error("Checkout error:", error)
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" })
      setBusyId(null)
    }
  }

  const buy = (option: PricingOption) =>
    option.kind === "pack"
      ? startCheckout(option.id, "/api/stripe/create-pack-checkout", { pack_id: option.id })
      : startCheckout(option.id, "/api/stripe/create-checkout-session", { planId: option.id })

  const countWord = ["no", "one", "two", "three", "four"][options.length] ?? String(options.length)

  return (
    <>
      {isStripeTestMode() && (
        <div className="bg-amber-50 border-b-2 border-amber-300">
          <div className="container max-w-6xl mx-auto px-4 py-6">
            <Alert className="border-2 border-amber-300 bg-white shadow-lg">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              <AlertTitle className="text-xl font-bold text-amber-900 mb-3">Test mode</AlertTitle>
              <AlertDescription>
                <p className="text-amber-800 font-medium">
                  No real charges. Test card: 4242 4242 4242 4242 · Exp 12/34 · CVC 123 · ZIP 12345
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:py-20">
        {/* Header: short on phones so every option sits above the fold */}
        <div className="mb-5 text-center md:mb-14">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800 md:mb-6 md:px-4 md:py-2 md:text-sm">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
            Your first tale is free
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent md:mb-4 md:text-5xl lg:text-6xl">
            Simple pricing
          </h1>
          <p className="mx-auto max-w-xl text-sm text-gray-600 md:text-lg md:text-gray-700">
            Loved your free tale? Here are {countWord} ways to keep them coming.
          </p>
        </div>

        {/* Phones: pick one from a compact list, then one clear button */}
        <div className="md:hidden">
          <div role="radiogroup" aria-label="Choose how to get more tales" className="space-y-2.5">
            {options.map((option) => {
              const isSelected = option.id === selected?.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-colors",
                    isSelected ? "border-teal-500 shadow-sm" : "border-gray-200 active:bg-gray-50",
                  )}
                >
                  {option.id === featuredId && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Most popular
                    </span>
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      isSelected ? "border-teal-600 bg-teal-600" : "border-gray-300",
                    )}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-gray-900">{option.name}</span>
                      {option.badge && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {option.badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-gray-500">{option.summary}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold text-gray-900">{option.price}</span>
                    <span className="block text-xs text-gray-500">{option.cadence}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {selected && (
            <>
              {/* The button sits right under the choices, so it is on screen without scrolling */}
              <BuyButton option={selected} busyId={busyId} onBuy={buy} className="mt-4" />
              <p className="mt-2 text-center text-xs text-gray-500">{selected.reassurance}</p>
            </>
          )}

          {selected && (
            <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-900">{selected.tagline}</p>
              {selected.highlight && (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{selected.highlight}</p>
              )}
              <ul className="mt-3 space-y-2">
                {selected.features.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tablets and up: the options side by side */}
        <div
          className={cn(
            "mx-auto hidden gap-6 md:grid lg:gap-8",
            options.length === 3 ? "md:grid-cols-3" : "max-w-4xl md:grid-cols-2",
          )}
        >
          {options.map((option) => {
            const Icon = option.icon
            const featured = option.id === featuredId
            return (
              <div
                key={option.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-white p-7 transition-shadow hover:shadow-xl",
                  featured ? "border-2 border-teal-400 shadow-lg" : "border-gray-200",
                )}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                    Most popular{option.badge ? ` · ${option.badge}` : ""}
                  </div>
                )}
                <div className="text-center">
                  <div
                    className={cn(
                      "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
                      option.kind === "pack" ? "bg-amber-50" : "bg-teal-50",
                    )}
                  >
                    <Icon className={cn("h-7 w-7", option.kind === "pack" ? "text-amber-500" : "text-teal-600")} />
                  </div>
                  <h2 className="text-2xl font-bold">{option.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{option.tagline}</p>
                  <div className="mt-5 text-5xl font-bold">
                    {option.price}
                    <span className="text-lg font-medium text-gray-500"> {option.cadence}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{option.summary}</p>
                </div>
                {option.highlight && (
                  <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-900">
                    {option.highlight}
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2.5">
                  {option.features.map((f) => (
                    <Feature key={f}>{f}</Feature>
                  ))}
                </ul>
                <BuyButton option={option} busyId={busyId} onBuy={buy} className="mt-6" outline={!featured} />
                <p className="mt-2 text-center text-xs text-gray-500">{option.reassurance}</p>
              </div>
            )
          })}
        </div>

        {/* Billing basics: short, but everything a renewing plan must disclose */}
        <div className="mx-auto mt-8 max-w-md space-y-1 text-center text-xs leading-relaxed text-gray-500 md:mt-12 md:text-sm">
          <p>Plans renew monthly until you cancel. Cancel anytime in Settings.</p>
          <p>
            Unused plan tales roll over, up to two months&apos; worth.{pack ? " Pack tales never expire." : ""}
          </p>
          <p>
            Prices in USD. Payments are non-refundable.{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-gray-700">
              Terms
            </a>
          </p>
        </div>
      </div>
    </>
  )
}

function BuyButton({
  option,
  busyId,
  onBuy,
  className,
  outline = false,
}: {
  option: PricingOption
  busyId: string | null
  onBuy: (option: PricingOption) => void
  className?: string
  outline?: boolean
}) {
  const isBusy = busyId === option.id
  return (
    <button
      type="button"
      onClick={() => onBuy(option)}
      disabled={!option.available || busyId !== null}
      className={cn(
        "flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors disabled:opacity-60",
        outline
          ? "border-2 border-teal-600 bg-white text-teal-700 hover:bg-teal-50"
          : "bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700",
        className,
      )}
    >
      {isBusy ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Opening checkout...
        </>
      ) : option.available ? (
        option.cta
      ) : (
        "Coming soon"
      )}
    </button>
  )
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start text-sm text-gray-700">
      <Check className="mr-2.5 mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
      <span>{children}</span>
    </li>
  )
}
