"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Coins, Loader2, Zap } from "lucide-react"
import { CREDIT_MESSAGES } from "@/lib/types/credit-types"
import Link from "next/link"
import { packLabel, priceSummary, type PackOffer } from "@/lib/pricing-config"
import { useBuyPack } from "@/components/billing/use-buy-pack"

interface OutOfCreditsBannerProps {
  balance: number
  /** The one-time pack on sale, if any */
  pack?: PackOffer | null
}

/** Shown on the create screen when the user has no tales left. */
export function OutOfCreditsBanner({ balance, pack }: OutOfCreditsBannerProps) {
  const { buy, buying } = useBuyPack()

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
            {balance > 0
              ? `You have ${balance} ${balance === 1 ? "tale" : "tales"} left.`
              : `Each Pet Tale uses 1 tale. ${priceSummary(pack ?? null)}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {pack && (
              <Button onClick={() => buy(pack)} disabled={buying} className="bg-teal-600 hover:bg-teal-700 text-white">
                {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                Get {packLabel(pack)}
              </Button>
            )}
            <Button
              asChild
              variant={pack ? "outline" : "default"}
              className={pack ? "bg-white" : "bg-teal-600 hover:bg-teal-700 text-white"}
            >
              <Link href="/pricing">
                <Zap className="mr-2 h-4 w-4" />
                See plans
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
