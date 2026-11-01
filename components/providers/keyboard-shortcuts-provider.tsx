"use client"

import type React from "react"

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  return <>{children}</>
}
