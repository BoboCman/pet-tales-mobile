"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Coins, Mail, Zap } from "lucide-react"
import { CREDIT_MESSAGES } from "@/lib/types/credit-types"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface OutOfCreditsBannerProps {
  balance: number
  onClaimDaily?: () => void
  isClaimingDaily?: boolean
  onRefreshCredits?: () => void
}

export function OutOfCreditsBanner({
  balance,
  onClaimDaily,
  isClaimingDaily = false,
  onRefreshCredits,
}: OutOfCreditsBannerProps) {
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false)
  const { toast } = useToast()

  const handleClaimDaily = async () => {
    if (onClaimDaily) {
      onClaimDaily()
      return
    }

    // Default faucet implementation for Phase 3A-5
    try {
      setIsClaimingFaucet(true)

      // Log claim attempt for observability
      console.log("ooc_banner_claim_clicked")

      const response = await fetch("/api/credits/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      // Log claim result for observability
      console.log("ooc_banner_claim_result", {
        ok: result.ok,
        code: result.code,
      })

      if (response.status === 404 || response.status === 501) {
        toast({
          title: "Daily faucet is coming soon.",
          description: "This feature will be available in the next update.",
        })
      } else if (result.ok) {
        toast({
          title: "Credits claimed!",
          description: "Your daily credit has been added to your account.",
        })
        // Refresh credits if callback provided
        if (onRefreshCredits) {
          onRefreshCredits()
        }
      } else {
        toast({
          title: "Claim failed",
          description: result.message || "Unable to claim daily credit.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Faucet claim error:", error)
      toast({
        title: "Claim failed",
        description: "Unable to claim daily credit. Please try again.",
        variant: "destructive",
      })

      // Log error for observability
      console.log("ooc_banner_claim_result", {
        ok: false,
        code: "NETWORK_ERROR",
      })
    } finally {
      setIsClaimingFaucet(false)
    }
  }

  const handleContactSupport = () => {
    const subject = encodeURIComponent("Pet Tales - Need More Credits")
    const body = encodeURIComponent(
      "Hi Pet Tales team,\n\nI've run out of credits and would like to request more. My current balance is " +
        balance +
        " credits.\n\nThank you!",
    )
    window.location.href = `mailto:support@pettales.app?subject=${subject}&body=${body}`
  }

  return (
    <Card className="p-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
            {CREDIT_MESSAGES.OUT_OF_CREDITS}
          </h3>
          <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
            You need at least 1 credit to create a new pet tale. Your current balance is {balance} credits.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
              <Link href="/pricing">
                <Zap className="mr-2 h-4 w-4" />
                Upgrade Now
              </Link>
            </Button>
            <Button
              onClick={handleClaimDaily}
              disabled={isClaimingDaily || isClaimingFaucet}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900/30 bg-transparent"
            >
              <Coins className="mr-2 h-4 w-4" />
              {isClaimingDaily || isClaimingFaucet ? "Claiming..." : "Claim daily +1"}
            </Button>
            <Button
              variant="outline"
              onClick={handleContactSupport}
              className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900/30 bg-transparent"
            >
              <Mail className="mr-2 h-4 w-4" />
              Contact support
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
