"use client"

import { CreditsBadge } from "@/components/ui/credits-badge"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export function TopHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Don't render for unauthenticated users
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="hidden md:block bg-white border-b border-gray-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-end">
        <CreditsBadge refreshInterval={15000} />
      </div>
    </div>
  )
}
