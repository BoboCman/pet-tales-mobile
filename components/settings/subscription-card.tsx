"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, CalendarClock, Coins, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getPlanById, subscriptionPlans } from "@/lib/pricing-config"
import { useToast } from "@/hooks/use-toast"

interface BillingData {
  free_credits: number
  purchased_credits: number
  subscription_tier: string | null
  subscription_status: string | null
  subscription_period_end: string | null
  subscription_cancel_at_period_end: boolean | null
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export function SubscriptionCard({ user }: { user: any }) {
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingPortal, setOpeningPortal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchBilling() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("users")
          .select(
            "free_credits, purchased_credits, subscription_tier, subscription_status, subscription_period_end, subscription_cancel_at_period_end",
          )
          .eq("id", user.id)
          .single()

        if (error) throw error
        setBilling(data as BillingData)
      } catch (error) {
        console.error("[Settings] Error fetching billing:", error)
        toast({
          title: "Couldn't load your plan",
          description: "Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBilling()
  }, [user.id, toast])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan and tales</CardTitle>
          <CardDescription>Each Pet Tale uses 1 tale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const status = billing?.subscription_status ?? null
  // past_due still has a live Stripe subscription: the person needs the portal to fix their card
  const hasPlan = status === "active" || status === "trialing" || status === "past_due"
  const plan = hasPlan && billing?.subscription_tier ? getPlanById(billing.subscription_tier) : undefined
  const freeTales = billing?.free_credits || 0
  const packTales = billing?.purchased_credits || 0
  const totalTales = freeTales + packTales
  const periodEnd = formatDate(billing?.subscription_period_end ?? null)
  const cancelling = !!billing?.subscription_cancel_at_period_end
  const cheapest = [...subscriptionPlans].sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0]

  const openBillingPortal = async () => {
    setOpeningPortal(true)
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.message || "Couldn't open billing")
      window.location.href = data.url
    } catch (error) {
      toast({
        title: "Couldn't open billing",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setOpeningPortal(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan and tales</CardTitle>
        <CardDescription>Each Pet Tale uses 1 tale</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-xl p-6 border-2 border-teal-200 dark:border-teal-700">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-teal-600">{totalTales}</span>
            <span className="text-muted-foreground text-lg">{totalTales === 1 ? "tale" : "tales"} left</span>
          </div>

          {/* Only split the balance when there are pack tales to show */}
          {packTales > 0 && (
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">{plan ? "Plan tales" : "Free tales"}</div>
                <div className="font-semibold text-lg">{freeTales}</div>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Pack tales (never expire)</div>
                <div className="font-semibold text-lg">{packTales}</div>
              </div>
            </div>
          )}
        </div>

        {plan && status === "past_due" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your last payment didn&apos;t go through. Update your card in Manage plan to keep {plan.name}.
            </AlertDescription>
          </Alert>
        )}

        {plan && cancelling && (
          <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
            <CalendarClock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900 dark:text-amber-100">
              {plan.name} is cancelled and ends {periodEnd ? `on ${periodEnd}` : "at the end of this billing period"}.
              You can keep using your tales until then. Changed your mind? Renew it in Manage plan.
            </AlertDescription>
          </Alert>
        )}

        {plan && !cancelling && (
          <Alert className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700">
            <Zap className="h-4 w-4 text-teal-600" />
            <AlertDescription className="text-teal-900 dark:text-teal-100">
              You&apos;re on {plan.name}: {plan.talesPerMonth} tales every month for ${plan.monthlyPrice.toFixed(2)}.
              {periodEnd && status !== "past_due" ? ` Renews on ${periodEnd}.` : ""}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 pt-4 border-t">
          {plan ? (
            <>
              <Button onClick={openBillingPortal} disabled={openingPortal} className="w-full" size="lg">
                <Coins className="mr-2 h-4 w-4" />
                {openingPortal ? "Opening..." : "Manage plan"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Change your card, see invoices or cancel. Cancelling stops renewal at the end of the month you paid
                for.
              </p>
            </>
          ) : (
            <>
              <Button asChild className="w-full" size="lg">
                <Link href="/pricing">
                  <Coins className="mr-2 h-4 w-4" />
                  See plans
                </Link>
              </Button>
              {cheapest && (
                <p className="text-xs text-center text-muted-foreground">
                  Plans from ${cheapest.monthlyPrice.toFixed(2)} a month · Cancel anytime
                </p>
              )}
            </>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm">
          <h4 className="font-semibold mb-2">Good to know</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Your first tale is free</li>
            <li>• Unused plan tales roll over for a month (up to two months&apos; worth)</li>
            <li>
              • Questions about billing? Email{" "}
              <a href="mailto:pettaleai@gmail.com" className="underline underline-offset-4">
                pettaleai@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
