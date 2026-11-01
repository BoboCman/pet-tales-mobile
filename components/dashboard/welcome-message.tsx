"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Sparkles } from "lucide-react"

interface WelcomeMessageProps {
  userName?: string
  className?: string
}

export function WelcomeMessage({ userName, className }: WelcomeMessageProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    // Update time
    const updateTime = () => {
      const now = new Date()
      const hour = now.getHours()
      let greeting = "Good morning"

      if (hour >= 12 && hour < 17) {
        greeting = "Good afternoon"
      } else if (hour >= 17) {
        greeting = "Good evening"
      }

      setCurrentTime(greeting)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  if (!isVisible) return null

  return (
    <Card
      className={`bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200 dark:from-teal-900/20 dark:to-blue-900/20 dark:border-teal-800 ${className}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                {currentTime}
                {userName ? `, ${userName}` : ""}!
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Ready to create some amazing pet tales today? Your furry friends are waiting to share their stories!
              </p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                  Create New Tale
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-900/20 bg-transparent"
                >
                  View Gallery
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
