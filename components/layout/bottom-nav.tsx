"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Home, Video, Users, Settings, LogIn, PawPrint, Plus, type LucideIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/**
 * Mobile bottom tab bar (hidden from md up by CSS, so it is tappable from the first paint).
 *
 * Built for one-tap navigation in the installed PWA:
 * - The tab lights up the moment it is touched, before the next page arrives.
 * - Tabs are stable elements (no components defined inside render), so a re-render mid-tap
 *   never swallows the click.
 * - The last known signed-in state is remembered on the device, so the real tabs show
 *   immediately instead of an untappable placeholder.
 * - The auth listener is set up once, not on every route change.
 */

type Tab = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean }

const SIGNED_IN_TABS: Tab[] = [
  {
    href: "/dashboard/reels",
    label: "Tales",
    icon: Video,
    match: (p) => p.startsWith("/dashboard/reels") && p !== "/dashboard/reels/new",
  },
  { href: "/dashboard/pets", label: "Pets", icon: PawPrint, match: (p) => p.startsWith("/dashboard/pets") },
  { href: "/dashboard/reels/new", label: "Create", icon: Plus, match: (p) => p === "/dashboard/reels/new" },
  { href: "/community/public", label: "Community", icon: Users, match: (p) => p.startsWith("/community") },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p.startsWith("/dashboard/settings"),
  },
]

const SIGNED_OUT_TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/community/public", label: "Community", icon: Users, match: (p) => p.startsWith("/community") },
  { href: "/auth/login", label: "Sign In", icon: LogIn, match: (p) => p.startsWith("/auth") },
]

/** Full-screen pages that bring their own controls: the tale viewers and the new tale screen */
function isHiddenOn(path: string) {
  return /^\/community\/public\/[^/]+$/.test(path) || /^\/dashboard\/reels\/[^/]+$/.test(path)
}

const AUTH_CACHE_KEY = "pettale:signed-in"

function readCachedAuth(): boolean | null {
  try {
    const v = window.localStorage.getItem(AUTH_CACHE_KEY)
    return v === "1" ? true : v === "0" ? false : null
  } catch {
    return null
  }
}

function writeCachedAuth(signedIn: boolean) {
  try {
    window.localStorage.setItem(AUTH_CACHE_KEY, signedIn ? "1" : "0")
  } catch {
    // Private mode or blocked storage: the nav still works, it just waits for the session.
  }
}

const BAR_CLASS =
  "fixed inset-x-0 bottom-0 z-[9999] select-none border-t border-teal-700 bg-teal-600 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"

export function BottomNav() {
  const pathname = usePathname() || "/"
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  // The tab the user just tapped, shown as active until the new route takes over
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    const cached = readCachedAuth()
    if (cached !== null) setSignedIn(cached)

    const supabase = createClient()
    let known: boolean | null = null

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const now = !!session
      const was = known
      known = now
      setSignedIn(now)
      writeCachedAuth(now)

      // Only react to real changes. Supabase repeats SIGNED_IN when the app comes back to the
      // foreground, and redirecting then would cancel whatever the user just tapped.
      if (event === "SIGNED_OUT" && was === true) {
        router.push("/")
      } else if (event === "SIGNED_IN" && now && was === false && pathnameRef.current.startsWith("/auth/")) {
        router.push("/dashboard/pets")
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (isHiddenOn(pathname)) return null

  // First visit on this device, before the session is known: same size bar, no fake buttons
  if (signedIn === null) {
    return <div data-bottom-nav="loading" aria-hidden className={BAR_CLASS}><div className="h-[70px]" /></div>
  }

  const tabs = signedIn ? SIGNED_IN_TABS : SIGNED_OUT_TABS
  const activePath = pendingHref ?? pathname

  return (
    <nav
      data-bottom-nav={signedIn ? "authenticated" : "unauthenticated"}
      aria-label="Main"
      className={BAR_CLASS}
    >
      <ul className={`grid h-[70px] ${signedIn ? "grid-cols-5" : "grid-cols-3"}`}>
        {tabs.map((tab) => {
          const active = pendingHref ? tab.href === pendingHref : tab.match(activePath)
          const Icon = tab.icon
          const isCreate = tab.href === "/dashboard/reels/new"
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={isCreate ? "Create a new tale" : undefined}
                onClick={() => {
                  if (!tab.match(pathname)) setPendingHref(tab.href)
                }}
                className={`group flex h-full w-full flex-col items-center justify-center gap-1 outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [touch-action:manipulation] focus-visible:bg-white/10 ${
                  active ? "text-white" : "text-teal-100"
                }`}
              >
                {isCreate ? (
                  // Same 32px slot as the other icons so every label lines up; the circle overflows it
                  <span className="flex h-8 items-center">
                    <span
                      className={`flex h-10 w-10 -translate-y-1 items-center justify-center rounded-full shadow-lg transition-transform duration-100 group-active:scale-90 ${
                        active ? "bg-teal-100 text-teal-700" : "bg-white text-teal-600"
                      }`}
                    >
                      <Plus className="h-6 w-6" strokeWidth={2.5} />
                    </span>
                  </span>
                ) : (
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-[transform,background-color] duration-100 group-active:scale-90 group-active:bg-white/15 ${
                      active ? "bg-white/20" : ""
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                  </span>
                )}
                <span className={`text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
