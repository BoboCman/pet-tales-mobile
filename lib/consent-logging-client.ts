"use client"

interface ClientInfo {
  userAgent: string
  referrer: string
  language: string
  platform: string
  screenResolution: string
  timezone: string
  cookieEnabled: boolean
  doNotTrack: boolean
  touchSupport: boolean
  connectionType?: string
}

export function getClientInfo(): ClientInfo {
  // Ensure we're in a browser environment
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      referrer: "",
      language: "",
      platform: "",
      screenResolution: "",
      timezone: "",
      cookieEnabled: false,
      doNotTrack: false,
      touchSupport: false,
    }
  }

  // Mobile-specific client info gathering
  const clientInfo: ClientInfo = {
    userAgent: navigator.userAgent || "",
    referrer: document.referrer || "",
    language: navigator.language || navigator.languages?.[0] || "",
    platform: navigator.platform || "",
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    cookieEnabled: navigator.cookieEnabled || false,
    doNotTrack: navigator.doNotTrack === "1" || navigator.doNotTrack === "yes",
    touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0,
  }

  // Add connection information if available (mobile-specific)
  if ("connection" in navigator) {
    const connection = (navigator as any).connection
    if (connection) {
      clientInfo.connectionType = connection.effectiveType || connection.type || "unknown"
    }
  }

  return clientInfo
}

// Privacy-compliant data collection
export function getPrivacyCompliantClientInfo(): Partial<ClientInfo> {
  const fullInfo = getClientInfo()

  // Return only non-identifying information for privacy compliance
  return {
    language: fullInfo.language,
    platform: fullInfo.platform,
    screenResolution: fullInfo.screenResolution,
    timezone: fullInfo.timezone,
    cookieEnabled: fullInfo.cookieEnabled,
    doNotTrack: fullInfo.doNotTrack,
    touchSupport: fullInfo.touchSupport,
    connectionType: fullInfo.connectionType,
    // Exclude userAgent and referrer for privacy
  }
}

// Device type detection for mobile optimization
export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop"

  const userAgent = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent)

  if (isTablet) return "tablet"
  if (isMobile) return "mobile"
  return "desktop"
}

// Network information for mobile optimization
export function getNetworkInfo() {
  if (typeof window === "undefined" || !("connection" in navigator)) {
    return null
  }

  const connection = (navigator as any).connection
  if (!connection) return null

  return {
    effectiveType: connection.effectiveType || "unknown",
    downlink: connection.downlink || 0,
    rtt: connection.rtt || 0,
    saveData: connection.saveData || false,
  }
}

// Consent logging helper
export function createConsentData(consentType: string, additionalData?: Record<string, any>) {
  const clientInfo = getPrivacyCompliantClientInfo()
  const deviceType = getDeviceType()
  const networkInfo = getNetworkInfo()

  return {
    consentType,
    timestamp: new Date().toISOString(),
    clientInfo,
    deviceType,
    networkInfo,
    ...additionalData,
  }
}
