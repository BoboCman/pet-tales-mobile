"use client"

import { ADS_OPT_OUT_COOKIE, META_PIXEL_ID, type MetaEventName } from "@/lib/meta/shared"

/**
 * Browser side of Meta ad tracking. Every call is a no-op when the pixel is not configured,
 * the visitor opted out, or the browser sends Global Privacy Control.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export function adsOptedOut(): boolean {
  if (typeof window === "undefined") return true
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return true
  return document.cookie.split(/;\s*/).includes(`${ADS_OPT_OUT_COOKIE}=1`)
}

export function metaEnabled() {
  return Boolean(META_PIXEL_ID) && !adsOptedOut()
}

export function setAdsOptOut(optOut: boolean) {
  const maxAge = optOut ? 60 * 60 * 24 * 365 * 2 : 0
  document.cookie = `${ADS_OPT_OUT_COOKIE}=1; path=/; max-age=${maxAge}; samesite=lax${
    location.protocol === "https:" ? "; secure" : ""
  }`
  if (optOut) {
    // Drop Meta's own browser IDs too
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; path=/; max-age=0`
      document.cookie = `${name}=; path=/; max-age=0; domain=.${location.hostname.replace(/^www\./, "")}`
    }
  }
}

/** A fresh id shared by the browser event and its server twin, so Meta counts it once */
export function newEventId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`
}

export function trackMeta(name: MetaEventName, params?: Record<string, unknown>, eventId?: string) {
  if (!metaEnabled() || !window.fbq) return
  window.fbq("track", name, params || {}, eventId ? { eventID: eventId } : undefined)
}

// ---- Where a visitor came from (first touch), saved on their account at signup ----

const ATTR_KEY = "pettale:first-touch"
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ref"] as const

export type Attribution = Partial<Record<(typeof PARAMS)[number] | "landing_page" | "referrer" | "first_seen", string>>

/**
 * Remember the visit that first brought someone here, kept on this device until signup.
 * A later visit from an ad (utm_source or fbclid) replaces a first visit that had no ad tags.
 */
export function captureAttribution() {
  try {
    const url = new URL(window.location.href)
    const found: Attribution = {}
    for (const p of PARAMS) {
      const v = url.searchParams.get(p)
      if (v) found[p] = v.slice(0, 200)
    }
    const fromAd = (a: Attribution | null) => Boolean(a?.utm_source || a?.fbclid)
    const existing = readAttribution()
    if (existing && (fromAd(existing) || !fromAd(found))) return
    const external = document.referrer && !document.referrer.startsWith(window.location.origin)
    const record: Attribution = {
      ...found,
      landing_page: url.pathname.slice(0, 200),
      ...(external ? { referrer: document.referrer.slice(0, 200) } : {}),
      first_seen: new Date().toISOString(),
    }
    window.localStorage.setItem(ATTR_KEY, JSON.stringify(record))
  } catch {
    // Storage blocked: nothing to remember
  }
}

export function readAttribution(): Attribution | null {
  try {
    const v = window.localStorage.getItem(ATTR_KEY)
    return v ? (JSON.parse(v) as Attribution) : null
  } catch {
    return null
  }
}
