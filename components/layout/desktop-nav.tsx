"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CreditsBadge } from "@/components/ui/credits-badge"
// import { UserMenu } from "@/components/layout/user-menu"
import { QuickActionsMenu } from "@/components/ui/quick-actions-menu"
import { PawPrint, LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/dashboard/pets", label: "Pets" },
  { href: "/dashboard/reels", label: "Tales" },
  { href: "/community/public", label: "Community" },
  { href: "/pricing", label: "Pricing" },
]

export function DesktopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
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

  // Don't render anything until we know auth status
  if (isAuthenticated === null) {
    return (
      <nav className="hidden md:block bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Skeleton loader */}
            <div className="w-32 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      </nav>
    )
  }

  // Unauthenticated nav
  if (!isAuthenticated) {
    return (
      <nav className="hidden md:block bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <PawPrint className="h-6 w-6 text-teal-600" />
              <span className="font-bold text-xl text-gray-900 dark:text-white">Pet Tale</span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-8">
              <Link
                href="/community/public"
                className="text-sm font-medium text-gray-600 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 transition-colors"
              >
                Community
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-gray-600 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 transition-colors"
              >
                Pricing
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
                <Link href="/auth/signup">Get Started Free</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  // Authenticated nav
  return (
    <nav className="hidden md:block bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <PawPrint className="h-6 w-6 text-teal-600" />
            <span className="font-bold text-xl text-gray-900 dark:text-white">Pet Tale</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Credits Badge */}
            <CreditsBadge refreshInterval={15000} />

            {/* Quick Actions Menu */}
            <QuickActionsMenu />

            {/* Sign Out button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setIsSigningOut(true)
                try {
                  await supabase.auth.signOut()
                  router.push("/")
                  router.refresh()
                } catch (error) {
                  console.error("Error signing out:", error)
                } finally {
                  setIsSigningOut(false)
                }
              }}
              disabled={isSigningOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
