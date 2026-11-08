"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle } from "lucide-react"
import { RequestDataButton } from "./request-data-button"
import { createClient } from "@/lib/supabase/client"
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog"

export function DangerZone() {
  const { toast } = useToast()

  const deleteAccount = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return data.error || "Something went wrong. Please try again."
      await createClient().auth.signOut().catch(() => {})
      toast({ title: "Your account has been deleted", description: "We've sent a confirmation email. Take care!" })
      window.location.href = "/"
      return null
    } catch {
      return "Something went wrong. Please try again."
    }
  }

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <CardTitle>Account Actions</CardTitle>
        </div>
        <CardDescription>Permanent actions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RequestDataButton />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-2 border-red-300 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950">
          <div className="flex-1">
            <h4 className="font-medium text-red-900 dark:text-red-100">Delete Account</h4>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1 leading-relaxed">
              Permanently delete your account and cancel any plan. Tales you made public stay up at their links unless you ask us to remove them.
            </p>
          </div>
          <DeleteAccountDialog
            title="Delete your account?"
            triggerLabel="Delete Account"
            confirmLabel="Delete my account"
            onConfirm={deleteAccount}
            description={
              <>
                <p>This can&apos;t be undone. It deletes your account, your pets and your private tales right away.</p>
                <p>Any plan is cancelled now, with no refund for the current month, and unused tales are lost.</p>
                <p>Tales you made public stay up at their links. Email us if you want any of those removed.</p>
              </>
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
