"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle } from "lucide-react"
import { RequestDataButton } from "./request-data-button"

export function DangerZone() {
  const { toast } = useToast()

  const handleDeleteAccount = () => {
    // TODO: Implement delete account with confirmation modal
    toast({
      title: "Delete account",
      description: "This feature will be available soon. Please contact support to delete your account.",
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
              Permanently delete your account and all data
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
