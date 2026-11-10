"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, Coins, Loader2, Zap, X } from "lucide-react"
import Link from "next/link"
import { cheapestPlan, packLabel, plansFromLabel, type PackOffer } from "@/lib/pricing-config"
import { useBuyPack } from "@/components/billing/use-buy-pack"

interface OutOfCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  balance: number
  /** The one-time pack on sale, if any: offered as a one-tap buy */
  pack?: PackOffer | null
}

export function OutOfCreditsModal({ isOpen, onClose, balance, pack }: OutOfCreditsModalProps) {
  const { buy, buying } = useBuyPack()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/20">
            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center text-xl">You&apos;re out of tales</DialogTitle>
          <DialogDescription className="text-center">
            Each Pet Tale uses 1 tale.{" "}
            {pack
              ? `Get ${packLabel(pack)} with no subscription, or a plan from ${plansFromLabel} for ${cheapestPlan.talesPerMonth} tales.`
              : `Plans start at ${plansFromLabel} for ${cheapestPlan.talesPerMonth} tales.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tales left</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{balance}</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {pack && (
            <Button
              onClick={() => buy(pack)}
              disabled={buying}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
              Get {packLabel(pack)}
            </Button>
          )}
          <Button
            asChild
            variant={pack ? "outline" : "default"}
            className={pack ? "w-full" : "w-full bg-teal-600 hover:bg-teal-700 text-white"}
          >
            <Link href="/pricing">
              <Zap className="mr-2 h-4 w-4" />
              See plans
            </Link>
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            <X className="mr-2 h-4 w-4" />
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
