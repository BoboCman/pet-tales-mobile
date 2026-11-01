"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function useKeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Cmd/Ctrl + N: New tale
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push("/dashboard/reels/new")
      }

      // Cmd/Ctrl + P: New pet
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push("/dashboard/pets/new")
      }

      // Cmd/Ctrl + B: Buy credits
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push("/pricing")
      }

      // Cmd/Ctrl + ,: Settings
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        router.push("/dashboard/settings")
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [router])
}
