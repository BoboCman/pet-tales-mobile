"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    async function checkAuth() {
      if (isLoginPage) {
        setIsLoading(false)
        return
      }

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/admin/login")
        return
      }

      const { data: userData } = await supabase
        .from("users")
        .select("email, is_admin")
        .eq("id", session.user.id)
        .single()

      if (!userData || !userData.is_admin) {
        await supabase.auth.signOut()
        router.push("/admin/login")
        return
      }

      setUserEmail(userData.email)
      setIsLoading(false)
    }

    checkAuth()
  }, [router, isLoginPage])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()

    const res = await fetch("/api/admin/logout", { method: "POST" })
    if (res.ok) {
      router.push("/admin/login")
    }
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-teal-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Admin Navbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Pet Tales Admin</h1>
                <p className="text-xs text-gray-500">Logged in as {userEmail}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  )
}
