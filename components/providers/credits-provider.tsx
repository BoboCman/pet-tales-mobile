"use client"

import { useCreditToasts } from "@/hooks/use-credits-toasts"
import type { ReactNode } from "react"

interface CreditsProviderProps {
  children: ReactNode
}

export function CreditsProvider({ children }: CreditsProviderProps) {
  // Initialize credit toasts globally
  useCreditToasts()

  return <>{children}</>
}
