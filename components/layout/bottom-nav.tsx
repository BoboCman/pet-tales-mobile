"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Home, Video, Users, Settings, LogIn, PawPrint, Zap } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useMobile } from "@/hooks/use-mobile"
import Link from "next/link"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isMobile = useMobile()
  const supabase = createClient()

  // Memoized auth check function
  const checkAuthState = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error("Auth check error:", error)
        setIsAuthenticated(false)
      } else {
        setIsAuthenticated(!!session)
      }
    } catch (error) {
      console.error("Failed to check auth state:", error)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    // Initial auth check
    checkAuthState()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, !!session)
      setIsAuthenticated(!!session)
      setIsLoading(false)

      // Handle sign out
      if (event === "SIGNED_OUT") {
        router.push("/")
      }

      // Handle sign in - redirect to pets dashboard
      if (event === "SIGNED_IN" && session) {
        // Small delay to ensure the UI updates properly
        setTimeout(() => {
          if (pathname.startsWith("/auth/")) {
            router.push("/dashboard/pets")
          }
        }, 100)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname, checkAuthState])

  // Helper function to determine if a nav item is active
  const isActive = useCallback(
    (path: string) => {
      if (path === "/" && pathname === "/") {
        return true
      }
      if (path === "/dashboard/pets" && (pathname === "/dashboard/pets" || pathname.startsWith("/dashboard/pets"))) {
        return true
      }
      if (path === "/dashboard/reels" && pathname.startsWith("/dashboard/reels")) {
        return true
      }
      if (path === "/community/public" && pathname.startsWith("/community")) {
        return true
      }
      if (path === "/dashboard/settings" && pathname.startsWith("/dashboard/settings")) {
        return true
      }
      if (path !== "/" && path !== "/dashboard/pets" && path !== "/community/public" && pathname.startsWith(path)) {
        return true
      }
      return false
    },
    [pathname],
  )

  // Check if we're on a public tale viewer page
  const isPublicTaleViewer = pathname.match(/^\/community\/public\/[^/]+$/)

  const isPrivateTaleViewer = pathname.match(/^\/dashboard\/reels\/[^/]+$/)

  // Common navigation item component
  const NavItem = ({ path, icon, label }: { path: string; icon: React.ReactNode; label: string }) => {
    const active = isActive(path)
    return (
      <Link
        href={path}
        className={`
          inline-flex flex-col items-center justify-start pt-3 relative min-h-[60px]
          transition-colors duration-200 ease-in-out
          ${active ? "text-white" : "text-teal-100 hover:text-white"}
        `}
        style={{
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div className="mb-0.5 flex-shrink-0">{icon}</div>
        <span className="text-xs font-medium leading-none text-center">{label}</span>
        {active && (
          <div
            className="absolute bottom-1 h-1 w-6 bg-white rounded-full"
            style={{
              transition: "opacity 0.2s ease-in-out",
              opacity: 1,
            }}
          />
        )}
      </Link>
    )
  }

  // Debug logging (remove in production)
  console.log("BottomNav render:", {
    isMobile,
    isAuthenticated,
    isLoading,
    pathname,
    isPublicTaleViewer,
    isPrivateTaleViewer,
  })

  // Don't render the bottom nav on desktop
  if (!isMobile) {
    return null
  }

  // Don't render the bottom nav when viewing public tales
  if (isPublicTaleViewer) {
    return null
  }

  if (isPrivateTaleViewer) {
    return null
  }

  // Show loading state briefly to prevent flash
  if (isLoading) {
    return (
      <div
        data-bottom-nav="loading"
        className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-teal-700 bg-teal-600 pb-[env(safe-area-inset-bottom,24px)] md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
        }}
      >
        <div className="grid h-[70px] grid-cols-3 animate-pulse">
          <div className="flex flex-col items-center justify-center">
            <div className="w-5 h-5 bg-teal-400 rounded mb-1"></div>
            <div className="w-8 h-2 bg-teal-400 rounded"></div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="w-5 h-5 bg-teal-400 rounded mb-1"></div>
            <div className="w-12 h-2 bg-teal-400 rounded"></div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="w-5 h-5 bg-teal-400 rounded mb-1"></div>
            <div className="w-10 h-2 bg-teal-400 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // For non-authenticated users
  if (!isAuthenticated) {
    return (
      <div
        data-bottom-nav="unauthenticated"
        className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-teal-700 bg-teal-600 pb-[env(safe-area-inset-bottom,24px)] md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
        }}
      >
        <div className="grid h-[70px] grid-cols-3">
          <NavItem path="/" icon={<Home className="w-5 h-5" />} label="Home" />
          <NavItem path="/community/public" icon={<Users className="w-5 h-5" />} label="Community" />
          <NavItem path="/auth/login" icon={<LogIn className="w-5 h-5" />} label="Sign In" />
        </div>
      </div>
    )
  }

  // For authenticated users
  return (
    <div
      data-bottom-nav="authenticated"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-teal-700 bg-teal-600 pb-[env(safe-area-inset-bottom,24px)] md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <div className="grid h-[70px] grid-cols-5">
        <NavItem path="/dashboard/pets" icon={<PawPrint className="w-5 h-5" />} label="Pets" />
        <NavItem path="/dashboard/reels" icon={<Video className="w-5 h-5" />} label="Tales" />
        <NavItem path="/community/public" icon={<Users className="w-5 h-5" />} label="Community" />
        <NavItem path="/pricing" icon={<Zap className="w-5 h-5" />} label="Credits" />
        <NavItem path="/dashboard/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
      </div>
    </div>
  )
}
