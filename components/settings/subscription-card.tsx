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

        if (data.last_weekly_credit_date) {
          const lastDate = new Date(data.last_weekly_credit_date)
          const nextDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000)
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
              <div className="text-muted-foreground mb-1">Free</div>
              <div className="font-semibold text-lg">{freeCredits}</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="text-muted-foreground mb-1">Purchased</div>
              <div className="font-semibold text-lg">{purchasedCredits}</div>
            </div>
          </div>
        </div>

        {daysUntilNext !== null && (
          <Alert className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700">
            <Calendar className="h-4 w-4 text-teal-600" />
            <AlertDescription className="text-teal-900 dark:text-teal-100">
              {daysUntilNext === 0 ? (
                <>
                  <Zap className="inline h-4 w-4 mr-1" />
                  Your weekly free credit is available now!
                </>
              ) : (
                <>
                  Next free credit in {daysUntilNext} day{daysUntilNext !== 1 ? "s" : ""}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 pt-4 border-t">
          <Button asChild className="w-full" size="lg">
            <Link href="/pricing">
              <Coins className="mr-2 h-4 w-4" />
              Buy Credit Packs
            </Link>
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">Get 1 free credit every week • Credits never expire</p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm">
          <h4 className="font-semibold mb-2">QUICK FACTS:</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Started with 3 welcome credits</li>
            <li>• Get 1 free credit weekly</li>
            <li>• Buy packs from $4.99</li>
            <li>• No subscription needed</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
