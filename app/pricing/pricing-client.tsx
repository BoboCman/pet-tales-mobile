"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check, Coins, Loader2, PawPrint, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { CreditPack } from "@/lib/stripe/pack-config"
import { isStripeTestMode } from "@/lib/stripe/test-mode"
import { FREE_TIER, subscriptionPlans, type PlanId } from "@/lib/pricing-config"

interface PricingClientProps {
  packs: CreditPack[]
  /** Plans with a Stripe price configured; others show as "Coming soon" */
  availablePlanIds: PlanId[]
}

export default function PricingClient({ packs, availablePlanIds }: PricingClientProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // Top-up packs: show the smallest active pack for people who don't want a plan
  const topUpPack = packs.length > 0 ? [...packs].sort((a, b) => a.credits - b.credits)[0] : null

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (!sessionId) return

    if (searchParams.get("pack_purchase") === "success") {
      toast({
        title: "🎉 Tales added!",
        description: "Your tales have been added to your account. Start creating!",
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

      <div className="container mx-auto px-4 py-12 md:py-20 pb-24 md:pb-20">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Your first tale is free
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
            Simple, monthly pricing
          </h1>

          <p className="text-base md:text-lg text-gray-700 max-w-2xl mx-auto font-medium">
            Your first tale is on us. Pick a plan when you want more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto mb-16">
          {/* Free */}
          <Card className="relative flex flex-col">
            <CardHeader className="text-center pb-6 pt-8">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center bg-gray-100">
                <PawPrint className="h-8 w-8 text-gray-500" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-bold mb-2">Free</CardTitle>
              <CardDescription className="text-base">Try it out, no card needed</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 text-center space-y-6">
              <div>
                <div className="text-5xl font-bold">$0</div>
                <div className="text-sm text-muted-foreground mt-1">to try it</div>
              </div>
              <ul className="space-y-3 text-left">
                <PlanFeature>
                  {FREE_TIER.welcomeTales} tale when you sign up
                </PlanFeature>
                <PlanFeature>All narrator voices and vibes</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-0">
              <Button asChild variant="outline" className="w-full h-12 text-base font-semibold">
                <a href="/auth/signup">Start free</a>
              </Button>
            </CardFooter>
          </Card>

          {/* Paid plans */}
          {subscriptionPlans.map((plan) => {
            const available = availablePlanIds.includes(plan.id)
            const isBusy = busyId === plan.id
            const perTale = (plan.monthlyPrice / plan.talesPerMonth).toFixed(2)

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-all duration-200",
                  plan.popular && "border-2 border-teal-400 shadow-lg",
                  "hover:shadow-xl hover:-translate-y-1 hover:border-teal-300",
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}
                <CardHeader className="text-center pb-6 pt-8">
                  <div
                    className={cn(
                      "mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center",
                      plan.popular ? "bg-gradient-to-br from-teal-100 to-emerald-100" : "bg-teal-50",
                    )}
                  >
                    <Sparkles className={cn("h-8 w-8", plan.popular ? "text-teal-600" : "text-teal-500")} />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl font-bold mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 text-center space-y-6">
                  <div>
                    <div className="text-5xl font-bold">
                      ${plan.monthlyPrice.toFixed(2)}
                      <span className="text-lg font-medium text-muted-foreground">/mo</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {plan.talesPerMonth} tales a month · ${perTale} per tale
                    </div>
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((feature) => (
                      <PlanFeature key={feature}>{feature}</PlanFeature>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    onClick={() => startCheckout(plan.id, "/api/stripe/create-checkout-session", { planId: plan.id })}
                    disabled={!available || busyId !== null}
                    className={cn(
                      "w-full h-12 text-base font-semibold transition-all hover:scale-105 active:scale-95",
                      plan.popular
                        ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                        : "bg-teal-600 hover:bg-teal-700",
                    )}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : available ? (
                      `Get ${plan.name}`
                    ) : (
                      "Coming soon"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {topUpPack && (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="bg-white rounded-lg border p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
              <div className="h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Coins className="h-7 w-7 text-teal-500" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-1">Not ready for a plan?</h3>
                <p className="text-muted-foreground text-sm">
                  Get {topUpPack.credits} tales for ${(topUpPack.price_cents / 100).toFixed(2)}. Pack tales never
                  expire and are used after your plan or free tales.
                </p>
              </div>
              <Button
                onClick={() => startCheckout(topUpPack.id, "/api/stripe/create-pack-checkout", { pack_id: topUpPack.id })}
                disabled={busyId !== null}
                variant="outline"
                className="h-12 px-6 font-semibold"
              >
                {busyId === topUpPack.id ? <Loader2 className="h-5 w-5 animate-spin" /> : "Buy tales"}
              </Button>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto text-center text-sm text-muted-foreground space-y-1">
          <p>Plan tales reset each month and don&apos;t roll over. Cancel anytime.</p>
          <p>Prices in US dollars.</p>
        </div>
      </div>
    </>
  )
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start">
      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
      <span className="text-sm">{children}</span>
    </li>
  )
}
