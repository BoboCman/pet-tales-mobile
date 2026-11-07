"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Mail, Info } from "lucide-react"
import { SEO_CONFIG } from "@/lib/constants/seo"

export function RequestDataButton() {
  const [isRequesting, setIsRequesting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Opens an email to us so the request actually reaches a person (GDPR/CCPA: answer within 30 days)
  const handleRequestData = async () => {
    setIsRequesting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const email = user?.email ?? ""
      const subject = encodeURIComponent("Data export request")
      const body = encodeURIComponent(
        `Hi Pet Tale AI team,\n\nPlease send me a copy of my data.\n\nAccount email: ${email}\n\nThank you!`,
      )
      window.location.href = `mailto:${SEO_CONFIG.contactEmail}?subject=${subject}&body=${body}`
      toast({
        title: "Opening your email app",
        description: `Send the email and we'll reply to ${email || "you"} within 30 days.`,
        duration: 6000,
      })
    } catch (error) {
      console.error("Request error:", error)
      toast({
        title: "Couldn't open your email app",
        description: `Email ${SEO_CONFIG.contactEmail} to request your data.`,
        variant: "destructive",
      })
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
      <div className="flex-1 space-y-3">
        <h4 className="font-medium">Request My Data</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">Get a copy of your data via email</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
          <div className="flex gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-blue-900 dark:text-blue-100 space-y-2">
              <p className="font-medium">What's included:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Account & pet profiles</li>
                <li>Tale content & video links</li>
                <li>Purchase history</li>
              </ul>
              <p className="text-blue-700 dark:text-blue-300">Email us and we'll send your data within 30 days.</p>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleRequestData}
        disabled={isRequesting}
        variant="outline"
        size="sm"
        className="w-full sm:w-auto sm:min-w-[140px] bg-transparent"
      >
        <Mail className="h-4 w-4 mr-2" />
        Request Data
      </Button>
    </div>
  )
}
