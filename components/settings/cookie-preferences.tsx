"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Shield, Eye, BarChart3, Zap } from "lucide-react"

interface CookiePreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  functional: boolean
}

export function CookiePreferences() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("cookie-preferences")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPreferences({
          necessary: true, // Always true
          analytics: parsed.analytics || false,
          marketing: parsed.marketing || false,
          functional: parsed.functional !== false, // Default to true
        })
      } catch (error) {
        console.error("Error parsing cookie preferences:", error)
      }
    }
  }, [])

  const handlePreferenceChange = (key: keyof CookiePreferences, value: boolean) => {
    if (key === "necessary") return // Cannot change necessary cookies

    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const savePreferences = async () => {
    setIsLoading(true)
    try {
      // Save to localStorage
      localStorage.setItem("cookie-preferences", JSON.stringify(preferences))

      // Here you would typically also send to your analytics service
      // or backend to respect the user's choices

      toast({
        title: "Preferences saved",
        description: "Your cookie preferences have been updated.",
      })
    } catch (error) {
      toast({
        title: "Error saving preferences",
        description: "Failed to save your cookie preferences.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const acceptAll = () => {
    setPreferences({
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    })
  }

  const rejectAll = () => {
    setPreferences({
      necessary: true, // Cannot be disabled
      analytics: false,
      marketing: false,
      functional: false,
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Necessary Cookies */}
        <div className="flex items-start justify-between p-4 border rounded-lg bg-gray-50">
          <div className="flex items-start gap-3 flex-1">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-medium">Necessary Cookies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Essential cookies required for the website to function properly. These cannot be disabled.
              </p>
            </div>
          </div>
          <Switch checked={preferences.necessary} disabled className="mt-1" />
        </div>

        {/* Functional Cookies */}
        <div className="flex items-start justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3 flex-1">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium">Functional Cookies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enable enhanced functionality like remembering your preferences and settings.
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.functional}
            onCheckedChange={(checked) => handlePreferenceChange("functional", checked)}
            className="mt-1"
          />
        </div>

        {/* Analytics Cookies */}
        <div className="flex items-start justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3 flex-1">
            <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-medium">Analytics Cookies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Help us understand how you use our website to improve your experience.
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.analytics}
            onCheckedChange={(checked) => handlePreferenceChange("analytics", checked)}
            className="mt-1"
          />
        </div>

        {/* Marketing Cookies */}
        <div className="flex items-start justify-between p-4 border rounded-lg">
          <div className="flex items-start gap-3 flex-1">
            <Eye className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-medium">Marketing Cookies</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Used to show you relevant advertisements and measure the effectiveness of our campaigns.
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.marketing}
            onCheckedChange={(checked) => handlePreferenceChange("marketing", checked)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <Button onClick={savePreferences} disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : "Save Preferences"}
        </Button>
        <Button onClick={acceptAll} variant="outline" className="flex-1 bg-transparent">
          Accept All
        </Button>
        <Button onClick={rejectAll} variant="outline" className="flex-1 bg-transparent">
          Reject All
        </Button>
      </div>

      <div className="text-xs text-muted-foreground pt-4 border-t">
        <p>
          Your cookie preferences are stored locally and will be remembered for future visits. You can change these
          settings at any time.
        </p>
      </div>
    </div>
  )
}
