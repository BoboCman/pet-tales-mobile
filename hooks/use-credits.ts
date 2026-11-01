"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

type CreditBalanceResponse = {
  ok: boolean
  balance: number
  code?: string
  message?: string
}

async function fetchBalance(): Promise<CreditBalanceResponse> {
  const res = await fetch("/api/credits/balance", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, balance: 0, code: "SERVER_ERROR", message: "Unable to fetch credits" }
  return res.json()
}

interface UseCreditsOptions {
  refreshInterval?: number
  revalidateOnFocus?: boolean
  enableRealtimeUpdates?: boolean
}

interface UseCreditsReturn {
  balance: number | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshWithRouter: () => Promise<void>
}

export function useCredits(options: UseCreditsOptions = {}): UseCreditsReturn {
  const { refreshInterval = 0, revalidateOnFocus = true, enableRealtimeUpdates = true } = options
  const router = useRouter()

  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredits = useCallback(async (trigger = "initial") => {
    try {
      const result: CreditBalanceResponse = await fetchBalance()

      if (result.ok) {
        setBalance(result.balance)
        setError(null)

        // Log successful refresh for observability
        console.log("credits_badge_refreshed", {
          balance: result.balance,
          trigger,
        })
      } else {
        setError(result.message || "Failed to fetch credits")
        console.error("Credits fetch failed:", result)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      console.error("Credits fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    await fetchCredits("manual")
  }, [fetchCredits])

  const refreshWithRouter = useCallback(async () => {
    setIsLoading(true)
    // Refresh server components and client state
    router.refresh()
    await fetchCredits("router_refresh")
  }, [fetchCredits, router])

  // Initial fetch - only run once on mount
  useEffect(() => {
    console.log("🔄 useCredits: Initial fetch triggered")
    fetchCredits("initial")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Refresh interval for pages with ongoing processing
  useEffect(() => {
    if (refreshInterval > 0) {
      console.log("⏱️  useCredits: Setting up refresh interval:", refreshInterval)
      const interval = setInterval(() => {
        fetchCredits("interval")
      }, refreshInterval)

      return () => {
        console.log("⏱️  useCredits: Clearing refresh interval")
        clearInterval(interval)
      }
    }
  }, [refreshInterval, fetchCredits])

  // Revalidate on window focus
  useEffect(() => {
    if (revalidateOnFocus) {
      const handleFocus = () => {
        console.log("👁️  useCredits: Window focused, refreshing credits")
        fetchCredits("focus")
      }

      window.addEventListener("focus", handleFocus)
      return () => window.removeEventListener("focus", handleFocus)
    }
  }, [revalidateOnFocus, fetchCredits])

  // Listen for real-time credit updates
  useEffect(() => {
    if (enableRealtimeUpdates) {
      console.log("📡 useCredits: Enabling realtime updates")

      const handleCreditsUpdated = (event: CustomEvent) => {
        const { balance: newBalance } = event.detail

        console.log("🔔 CREDIT UPDATE EVENT RECEIVED:", {
          oldBalance: balance,
          newBalance: newBalance,
          difference: newBalance - (balance || 0),
          trigger: "realtime",
        })

        setBalance(newBalance)
        setError(null)
        setIsLoading(false)

        // Log realtime update for observability
        console.log("credits_badge_refreshed", {
          balance: newBalance,
          trigger: "realtime",
        })
      }

      window.addEventListener("creditsUpdated", handleCreditsUpdated as EventListener)
      console.log("✅ useCredits: Listening for creditsUpdated events")

      return () => {
        console.log("🔌 useCredits: Removing creditsUpdated listener")
        window.removeEventListener("creditsUpdated", handleCreditsUpdated as EventListener)
      }
    }
  }, [enableRealtimeUpdates, balance]) // Include balance to log changes

  return {
    balance,
    isLoading,
    error,
    refresh,
    refreshWithRouter,
  }
}
