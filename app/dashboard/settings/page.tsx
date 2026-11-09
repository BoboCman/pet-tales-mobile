import type { Metadata } from "next"
import { createClient, getUserDetails } from "@/lib/supabase/server"
import { SettingsView, type BillingData } from "@/components/settings/settings-view"

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Pet Tale AI account settings and preferences",
}

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await getUserDetails()

  let billing: BillingData | null = null
  if (user?.id) {
    const { data } = await createClient()
      .from("users")
      .select(
        "free_credits, purchased_credits, subscription_tier, subscription_status, subscription_period_end, subscription_cancel_at_period_end",
      )
      .eq("id", user.id)
      .maybeSingle()
    billing = (data as BillingData) ?? null
  }

  return <SettingsView user={user} billing={billing} />
}
