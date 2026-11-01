"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)

    const checkMobile = () => {
      // PRIMARY: Use viewport width as the main determinant
      const isNarrowViewport = window.innerWidth < 1024

      // SECONDARY: Check if it's definitely a mobile device
      const isSmallScreen = window.innerWidth < 768
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

      // Use mobile layout if:
      // 1. Viewport < 1024px (prevents broken desktop grid)
      // 2. OR it's a small-screen mobile device
      const shouldUseMobileLayout = isNarrowViewport || (isSmallScreen && isMobileUA)

      setIsMobile(shouldUseMobileLayout)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    window.addEventListener("orientationchange", () => setTimeout(checkMobile, 100))

    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("orientationchange", checkMobile)
    }
  }, [])

  if (!isClient) {
    return false
  }

  return isMobile
}

export const useIsMobile = useMobile
