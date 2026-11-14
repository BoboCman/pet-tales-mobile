"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"

/**
 * One-tap "Save to phone" for a finished tale.
 *
 * iPhone: the video is fetched quietly in the background once the tale starts playing, so a tap on
 * Save opens the share sheet straight away and "Save Video" puts it in Photos. (Safari only opens
 * the share sheet right after a tap, so the file has to be ready before the tap.) If the tap comes
 * before the file is ready, we finish fetching and offer a "Save to Photos" button for one more tap.
 *
 * Android: a normal download, which lands in Downloads and shows up in Photos / Gallery.
 *
 * Elsewhere: the same download as the desktop button.
 */

export type SaveState = "idle" | "preparing" | "ready-to-tap"

const MAX_PREFETCH_BYTES = 80 * 1024 * 1024

function isIOS() {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent)
}

function saveDataOn() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return c?.saveData === true
}

async function getSignedUrl(entryId: string, filenameHint: string, variant: "original" | "social" = "original") {
  const res = await fetch("/api/downloads/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ entryId, filename: filenameHint, variant }),
  })
  if (!res.ok) throw Object.assign(new Error("signed-url"), { status: res.status })
  const data = await res.json()
  if (!data.url) throw new Error("signed-url")
  return { url: data.url as string, filename: (data.filename as string) || `${filenameHint}.mp4` }
}

export function useSaveToPhone({
  entryId,
  filenameHint,
  canSave,
  onFallbackDownload,
  variant = "original",
}: {
  entryId: string
  filenameHint: string
  /** The finished MP4 exists */
  canSave: boolean
  /** The existing download flow, for browsers that can't share files */
  onFallbackDownload: () => void
  /** "social": the copy with the title burned in, made on first request (no prefetch) */
  variant?: "original" | "social"
}) {
  const { toast } = useToast()
  const [state, setState] = useState<SaveState>("idle")
  const fileRef = useRef<File | null>(null)
  const pendingRef = useRef<Promise<File | null> | null>(null)

  const ios = typeof window !== "undefined" && isIOS()

  const fetchFile = useCallback((): Promise<File | null> => {
    if (fileRef.current) return Promise.resolve(fileRef.current)
    if (pendingRef.current) return pendingRef.current
    pendingRef.current = (async () => {
      try {
        const { url, filename } = await getSignedUrl(entryId, filenameHint, variant)
        const res = await fetch(url, { credentials: "omit" })
        if (!res.ok) throw new Error(`video ${res.status}`)
        const blob = await res.blob()
        if (blob.size > MAX_PREFETCH_BYTES) return null
        const name = filename.toLowerCase().endsWith(".mp4") ? filename : `${filename}.mp4`
        const file = new File([blob], name, { type: "video/mp4" })
        if (!navigator.canShare?.({ files: [file] })) return null
        fileRef.current = file
        return file
      } catch (error) {
        console.warn("[save-to-phone] prefetch failed:", error)
        return null
      } finally {
        pendingRef.current = null
      }
    })()
    return pendingRef.current
  }, [entryId, filenameHint, variant])

  /** Call once the tale is playing: gets the file ready so Save is instant (iPhone only) */
  const prefetch = useCallback(() => {
    if (variant === "social" || !ios || !canSave || saveDataOn() || typeof navigator.canShare !== "function") return
    void fetchFile()
  }, [variant, ios, canSave, fetchFile])

  // Forget the cached file if the tale changes
  useEffect(() => {
    fileRef.current = null
    pendingRef.current = null
    setState("idle")
  }, [entryId])

  const share = useCallback(
    async (file: File) => {
      try {
        await navigator.share({ files: [file] })
        setState("idle")
        return true
      } catch (error) {
        const name = error instanceof Error ? error.name : ""
        if (name === "AbortError") {
          setState("idle") // they closed the sheet
          return true
        }
        if (name === "NotAllowedError") {
          // The tap "expired" while the video downloaded: one more tap opens the sheet
          setState("ready-to-tap")
          return true
        }
        console.warn("[save-to-phone] share failed:", error)
        return false
      }
    },
    [],
  )

  const save = useCallback(async () => {
    if (!canSave || state === "preparing") return

    // iPhone: share sheet -> Save Video
    if (ios && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
      if (fileRef.current) {
        if (!(await share(fileRef.current))) onFallbackDownload()
        return
      }
      setState("preparing")
      const file = await fetchFile()
      if (!file) {
        setState("idle")
        onFallbackDownload()
        return
      }
      if (!(await share(file))) {
        setState("idle")
        onFallbackDownload()
      }
      return
    }

    // Android (and the social copy everywhere else): a real download, no page change
    if (isAndroid() || variant === "social") {
      setState("preparing")
      try {
        const { url, filename } = await getSignedUrl(entryId, filenameHint, variant)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        a.remove()
        toast(
          isAndroid()
            ? { title: "Saving to your phone", description: "It'll be in Downloads and your Photos or Gallery app." }
            : { title: "Download started", description: "Look in your Downloads folder." },
        )
      } catch (error) {
        const status = (error as { status?: number }).status
        toast({
          title: status === 404 ? "Your tale is still being made" : "Couldn't save the video",
          description: status === 404 ? "Try again in a minute." : "Please try again.",
          variant: status === 404 ? "default" : "destructive",
        })
      } finally {
        setState("idle")
      }
      return
    }

    onFallbackDownload()
  }, [canSave, state, ios, share, fetchFile, onFallbackDownload, entryId, filenameHint, variant, toast])

  /** Second tap after the file finished downloading (iPhone) */
  const saveReady = useCallback(async () => {
    if (fileRef.current) await share(fileRef.current)
    else setState("idle")
  }, [share])

  const cancelReady = useCallback(() => setState("idle"), [])

  return { state, save, saveReady, cancelReady, prefetch, isIOS: ios }
}
