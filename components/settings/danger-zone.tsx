"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle } from "lucide-react"
import { RequestDataButton } from "./request-data-button"
import { createClient } from "@/lib/supabase/client"
import { SEO_CONFIG } from "@/lib/constants/seo"

export function DangerZone() {
  const { toast } = useToast()

  // Deletion is handled by a person (we cancel any plan and remove the account), so open an email
  const handleDeleteAccount = async () => {
    const {
      data: { user },
    } = await createClient().auth.getUser()
    const email = user?.email ?? ""
    const subject = encodeURIComponent("Delete my account")
    const body = encodeURIComponent(
      `Hi Pet Tale AI team,\n\nPlease delete my account and cancel any plan.\n\nAccount email: ${email}\n\nThank you!`,
    )
    window.location.href = `mailto:${SEO_CONFIG.contactEmail}?subject=${subject}&body=${body}`
    toast({
      title: "Opening your email app",
      description: "Send the email and we'll confirm once your account is deleted.",
      duration: 6000,
    })
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
              Email us to permanently delete your account and cancel any plan. Shared tale links stay up unless you ask us to remove them.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto sm:min-w-[140px]"
            onClick={handleDeleteAccount}
          >
            Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
