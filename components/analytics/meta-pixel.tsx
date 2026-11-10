"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { META_PIXEL_ID } from "@/lib/meta/shared"
import { captureAttribution, metaEnabled, trackMeta } from "@/lib/meta/client"

/**
 * Loads the Meta Pixel (only when configured and the visitor hasn't opted out) and records a
 * PageView on every route change, plus ViewContent on the pricing page. Also remembers which ad
 * or link first brought the visitor, for their account at signup. Renders nothing.
 */
function loadPixel(pixelId: string) {
  if (window.fbq) return
  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args)
  }
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq
  const s = document.createElement("script")
  s.async = true
  s.src = "https://connect.facebook.net/en_US/fbevents.js"
  document.head.appendChild(s)
  fbq("init", pixelId)
}

export function MetaPixel() {
  const pathname = usePathname()
  const ready = useRef(false)

  useEffect(() => {
    captureAttribution()
    if (META_PIXEL_ID && metaEnabled()) {
      loadPixel(META_PIXEL_ID)
      ready.current = true
    }
  }, [])

  useEffect(() => {
    if (!ready.current) return
    trackMeta("PageView")
    if (pathname === "/pricing") trackMeta("ViewContent", { content_name: "Pricing" })
  }, [pathname])

  return null
}
