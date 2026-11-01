"use client"

import { useEffect, useState } from "react"
import { X, Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem("pwa-install-dismissed")
    if (dismissed) return

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // For Android/Chrome - capture the install prompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // For iOS - show banner immediately since there's no automatic prompt
    if (isIOSDevice) {
      setShowPrompt(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      // Show iOS instructions
      setShowIOSInstructions(true)
    } else if (deferredPrompt) {
      // Android/Chrome - trigger native install prompt
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        handleDismiss()
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowPrompt(false)
    setShowIOSInstructions(false)
  }

  if (!showPrompt) return null

  return (
    <>
      {/* Main Install Banner */}
      <div className="fixed bottom-[calc(70px+env(safe-area-inset-bottom,24px))] left-0 right-0 md:bottom-4 md:left-4 md:right-auto md:max-w-md z-50 mx-4 md:mx-0">
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg shadow-2xl p-4 relative">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-3 pr-6">
            <div className="bg-white/20 rounded-lg p-2 mt-0.5">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">Install Pet Tale AI</h3>
              <p className="text-sm text-white/90 mb-3">
                Add to your home screen for quick access and the best experience
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="bg-white text-teal-600 hover:bg-white/90 font-medium"
                >
                  {isIOS ? "Show Me How" : "Install Now"}
                </Button>
                <Button onClick={handleDismiss} size="sm" variant="ghost" className="text-white hover:bg-white/10">
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom duration-300">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-block bg-teal-100 rounded-full p-3 mb-4">
                <Download className="h-8 w-8 text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Install Pet Tale AI</h2>
              <p className="text-gray-600 text-sm">Follow these simple steps to add the app to your home screen</p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-gray-900 font-medium mb-1">Tap the Share button</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Share className="h-4 w-4" />
                    <span>In Safari&apos;s toolbar (bottom of screen)</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-gray-900 font-medium mb-1">Scroll down and tap &quot;Add to Home Screen&quot;</p>
                  <p className="text-sm text-gray-600">
                    You may need to scroll down in the share menu to find this option
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-gray-900 font-medium mb-1">Tap &quot;Add&quot; in the top right</p>
                  <p className="text-sm text-gray-600">The Pet Tale AI icon will appear on your home screen</p>
                </div>
              </div>
            </div>

            <Button onClick={handleDismiss} className="w-full bg-teal-600 hover:bg-teal-700">
              Got It
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
