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
import { AlertCircle, Zap, X } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface OutOfCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  currentTier?: string
  resetDate?: string | null
  balance: number
}

export function OutOfCreditsModal({
  isOpen,
  onClose,
  currentTier = "free",
  resetDate,
  balance,
}: OutOfCreditsModalProps) {
  const formatResetDate = (date: string | null) => {
    if (!date) return "Not scheduled"
    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return "Not scheduled"
    }
  }

  const getTierDisplay = (tier: string) => {
    const tierMap: Record<string, string> = {
      free: "Free",
      basic: "Basic",
      pro: "Pro",
      premium: "Premium",
    }
    return tierMap[tier.toLowerCase()] || "Free"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/20">
            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center text-xl">You're out of credits!</DialogTitle>
          <DialogDescription className="text-center">
            You need at least 1 credit to create a new Pet Tale. Upgrade your plan to get more credits and keep creating
            amazing stories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</span>
            <Badge variant="outline" className="capitalize">
              {getTierDisplay(currentTier)}
            </Badge>
          </div>

          {/* Credits Remaining */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Credits Remaining</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{balance}</span>
          </div>

          {/* Next Reset Date */}
          {resetDate && (
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Credits Reset</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{formatResetDate(resetDate)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button asChild className="w-full bg-teal-600 hover:bg-teal-700 text-white">
            <Link href="/pricing">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade Now
            </Link>
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full bg-transparent">
            <X className="mr-2 h-4 w-4" />
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
