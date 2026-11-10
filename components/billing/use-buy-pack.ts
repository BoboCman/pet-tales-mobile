"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import type { PackOffer } from "@/lib/pricing-config"

/** Starts Stripe checkout for the one-time pack, from anywhere in the app */
export function useBuyPack() {
  const { toast } = useToast()
  const [buying, setBuying] = useState(false)

  const buy = async (pack: PackOffer) => {
    setBuying(true)
    try {
      const res = await fetch("/api/stripe/create-pack-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: pack.id }),
      })
      if (res.status === 401) {
        window.location.href = `/auth/signup?redirect=${encodeURIComponent("/pricing")}`
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.message || "Couldn't start checkout")
      window.location.href = data.url
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setBuying(false)
    }
  }

  return { buy, buying }
}
