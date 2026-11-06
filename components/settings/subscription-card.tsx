"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Coins, Calendar, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getPlanById } from "@/lib/pricing-config"
import { useToast } from "@/hooks/use-toast"

interface CreditData {
  free_credits: number
  purchased_credits: number
  last_weekly_credit_date: string | null
}

export function SubscriptionCard({ user }: { user: any }) {
  const [credits, setCredits] = useState<CreditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysUntilNext, setDaysUntilNext] = useState<number | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const sessionId = searchParams.get("session_id")
  const packPurchase = searchParams.get("pack_purchase")

  useEffect(() => {
    async function fetchCredits() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("users")
          .select("free_credits, purchased_credits, last_weekly_credit_date")
          .eq("id", user.id)
          .single()

        if (error) throw error

        setCredits(data)

        // Plan info lives in separate columns; a missing column must not break the credits view
        const { data: subData } = await supabase
          .from("users")
          .select("subscription_tier, subscription_status")
          .eq("id", user.id)
          .single()
        const isSubscribed = subData?.subscription_status === "active" || subData?.subscription_status === "trialing"
        setPlanId(isSubscribed && subData?.subscription_tier ? subData.subscription_tier : null)

        if (data.last_weekly_credit_date) {
          const lastDate = new Date(data.last_weekly_credit_date)
          const nextDate = new Date(lastDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          const now = new Date()
          const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          setDaysUntilNext(Math.max(0, daysLeft))
        }

        if (packPurchase === "success" && sessionId) {
          toast({
            title: "Credits added successfully!",
            description: `Your credits have been added to your account. You now have ${(data.free_credits || 0) + (data.purchased_credits || 0)} total credits.`,
            duration: 8000,
          })

          // Clear query params
          window.history.replaceState({}, "", "/dashboard/settings?tab=billing")
        }
      } catch (error) {
        console.error("[Settings] Error fetching credits:", error)
        toast({
          title: "Error loading credits",
          description: "Failed to load your credit details. Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCredits()
  }, [user.id, sessionId, packPurchase, toast])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <CardTitle>Your Credits</CardTitle>
          </div>
          <CardDescription>Available for creating tales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const freeCredits = credits?.free_credits || 0
  const purchasedCredits = credits?.purchased_credits || 0
  const totalCredits = freeCredits + purchasedCredits
  const plan = planId ? getPlanById(planId) : undefined

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
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <CardTitle>Your Credits</CardTitle>
        </div>
        <CardDescription>Available for creating tales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-xl p-6 border-2 border-teal-200 dark:border-teal-700">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-5xl font-bold text-teal-600">{totalCredits}</span>
            <span className="text-muted-foreground text-lg">total credits</span>
          </div>

          {/* Credit Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="text-muted-foreground mb-1">Free / plan</div>
              <div className="font-semibold text-lg">{freeCredits}</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="text-muted-foreground mb-1">Packs</div>
              <div className="font-semibold text-lg">{purchasedCredits}</div>
            </div>
          </div>
        </div>

        {plan && (
          <Alert className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700">
            <Zap className="h-4 w-4 text-teal-600" />
            <AlertDescription className="text-teal-900 dark:text-teal-100">
              You're on {plan.name}: {plan.talesPerMonth} tales every month.
            </AlertDescription>
          </Alert>
        )}

        {!plan && daysUntilNext !== null && (
          <Alert className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700">
            <Calendar className="h-4 w-4 text-teal-600" />
            <AlertDescription className="text-teal-900 dark:text-teal-100">
              {daysUntilNext === 0 ? (
                <>
                  <Zap className="inline h-4 w-4 mr-1" />
                  Your free monthly tale is available now!
                </>
              ) : (
                <>
                  Next free tale in {daysUntilNext} day{daysUntilNext !== 1 ? "s" : ""}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 pt-4 border-t">
          {plan ? (
            <Button onClick={openBillingPortal} disabled={openingPortal} className="w-full" size="lg">
              <Coins className="mr-2 h-4 w-4" />
              {openingPortal ? "Opening..." : "Manage plan"}
            </Button>
          ) : (
            <Button asChild className="w-full" size="lg">
              <Link href="/pricing">
                <Coins className="mr-2 h-4 w-4" />
                See Plans
              </Link>
            </Button>
          )}

          <div className="text-center">
            <p className="text-xs text-muted-foreground">Get 1 free tale every month • Pack tales never expire</p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm">
          <h4 className="font-semibold mb-2">QUICK FACTS:</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Your first tale is free</li>
            <li>• Get 1 free tale every month</li>
            <li>• Plans from $4.99 a month</li>
            <li>• Plan tales reset monthly; pack tales never expire</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
