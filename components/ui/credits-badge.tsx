"use client"

import { Badge } from "@/components/ui/badge"
import { Coins } from "lucide-react"
import { useCredits } from "@/hooks/use-credits"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import Link from "next/link"

interface CreditsBadgeProps {
  className?: string
  refreshInterval?: number
  showIcon?: boolean
}

export function CreditsBadge({ className, refreshInterval, showIcon = true }: CreditsBadgeProps) {
  const pathname = usePathname()

  // Determine refresh interval based on page context
  const getRefreshInterval = () => {
    if (refreshInterval !== undefined) return refreshInterval

    // Pages with ongoing processing should refresh every 15s
    if (
      pathname?.includes("/dashboard/reels") ||
      pathname?.includes("/create") ||
      pathname?.includes("/upload") ||
      pathname?.includes("/processing")
    ) {
      return 15000 // 15 seconds
    }

    return 0 // No automatic refresh for other pages
  }

  const { balance, isLoading, error } = useCredits({
    refreshInterval: getRefreshInterval(),
    revalidateOnFocus: true,
    enableRealtimeUpdates: true,
  })

  // Removed useCreditToasts() call to prevent duplicate subscriptions

  if (isLoading) {
    return (
      <Badge variant="secondary" className={cn("animate-pulse", className)} aria-live="polite">
        {showIcon && <Coins className="w-3 h-3 mr-1" />}
        Tales: ...
      </Badge>
    )
  }

  if (error) {
    return (
      <Badge
        variant="outline"
        className={cn("text-muted-foreground", className)}
        title="Couldn't load your tales"
        aria-live="polite"
      >
        {showIcon && <Coins className="w-3 h-3 mr-1" />}
        Tales: —
      </Badge>
    )
  }

  const isOutOfCredits = balance === 0

  return (
    <Link href="/pricing" className="inline-block">
      <Badge
        variant={isOutOfCredits ? "destructive" : "default"}
        className={cn(
          isOutOfCredits
            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300"
            : "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-600 dark:bg-teal-900/20 dark:text-teal-300",
          "cursor-pointer transition-all hover:scale-105 gap-1.5 px-3 py-1.5",
          className,
        )}
        aria-live="polite"
      >
        {showIcon && <Coins className="h-3.5 w-3.5" />}
        <span className="font-semibold">{balance}</span>
        <span className="text-xs font-normal">{balance === 1 ? "tale" : "tales"}</span>
      </Badge>
    </Link>
  )
}
