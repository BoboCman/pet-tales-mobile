"use client"

import { useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { getCreditBalance } from "@/app/actions/credits-api-actions"

interface CreditTransactionEntry {
  id: string
  user_id: string
  amount: number // Changed from delta
  transaction_type: string // Changed from reason
  entry_id?: string
  metadata?: any
  created_at: string
}

export function useCreditToasts() {
  const { toast } = useToast()
  const supabase = createClient()

  const showCreditDebitToast = useCallback(
    (entry: CreditTransactionEntry, newBalance: number) => {
      const amount = Math.abs(entry.amount) // Changed from entry.delta
      const metadata = entry.metadata || {}

      if (metadata.duration_s && amount > 0) {
        const duration = Math.round(metadata.duration_s)
        toast({
          title: `Used ${amount} credit${amount > 1 ? "s" : ""} for a ${duration}s tale.`,
          description: `Balance: ${newBalance} credit${newBalance !== 1 ? "s" : ""} remaining`,
        })
      } else if (entry.transaction_type === "deduction") {
        toast({
          title: `Used ${amount} credit${amount > 1 ? "s" : ""} for your tale.`,
          description: `Balance: ${newBalance} credit${newBalance !== 1 ? "s" : ""} remaining`,
        })
      } else {
        toast({
          title: "Credits updated.",
          description: `Balance: ${newBalance}`,
        })
      }
    },
    [toast],
  )

  const showCreditGrantToast = useCallback(
    (entry: CreditTransactionEntry, newBalance: number) => {
      const amount = entry.amount // Changed from entry.delta
      const transactionType = entry.transaction_type // Changed from entry.reason

      let title = `Received ${amount} credit${amount > 1 ? "s" : ""}!`
      let description = `Balance: ${newBalance}`

      if (transactionType === "welcome") {
        title = "Welcome bonus received!"
        description = `You got ${amount} free credits to get started. Balance: ${newBalance}`
      } else if (transactionType === "weekly") {
        title = "Weekly credit claimed!"
        description = `You got your weekly +1 credit. Balance: ${newBalance}`
      } else if (transactionType === "purchase") {
        title = "Credits purchased!"
        description = `${amount} credits have been added to your account. Balance: ${newBalance}`
      } else {
        title = "Credits added!"
        description = `${amount} credits have been added. Balance: ${newBalance}`
      }

      toast({
        title,
        description,
      })
    },
    [toast],
  )

  const setupRealtimeSubscription = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      console.log("📡 Setting up realtime subscription for user:", user.id)
      const channel = supabase
        .channel("credit_transactions_changes") // Changed from credit_ledger_changes
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "credit_transactions", // Changed from credit_ledger
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log("🔔 Credit transaction received:", payload)

            const entry = payload.new as CreditTransactionEntry
            console.log("💳 Transaction details:", {
              amount: entry.amount,
              type: entry.transaction_type,
              transaction_id: entry.id,
            })

            const balanceResult = await getCreditBalance()

            if (!balanceResult.ok) {
              console.error("❌ Failed to fetch updated balance:", balanceResult)
              return
            }

            const newBalance = balanceResult.balance
            console.log("📊 Updated balance:", newBalance)

            // Show appropriate toast based on amount
            if (entry.amount < 0) {
              // Debit (negative amount)
              showCreditDebitToast(entry, newBalance)
            } else if (entry.amount > 0) {
              // Grant (positive amount)
              showCreditGrantToast(entry, newBalance)
            }

            // Trigger a custom event for other components to listen to
            console.log("📡 Dispatching creditsUpdated event with balance:", newBalance)
            window.dispatchEvent(
              new CustomEvent("creditsUpdated", {
                detail: { balance: newBalance, entry },
              }),
            )
          },
        )
        .subscribe((status) => {
          console.log("📡 Realtime subscription status:", status)
          if (status === "SUBSCRIBED") {
            console.log("✅ Successfully subscribed to credit_transactions changes")
          } else if (status === "CHANNEL_ERROR") {
            console.error("❌ Error subscribing to credit_transactions")
          }
        })

      return () => {
        console.log("🔌 Cleaning up realtime subscription")
        supabase.removeChannel(channel)
      }
    } catch (error) {
      console.error("Failed to setup credit realtime subscription:", error)
    }
  }, [supabase, showCreditDebitToast, showCreditGrantToast])

  useEffect(() => {
    const cleanup = setupRealtimeSubscription()
    return () => {
      cleanup?.then((fn) => fn?.())
    }
  }, [setupRealtimeSubscription])

  return {
    showCreditDebitToast,
    showCreditGrantToast,
  }
}
