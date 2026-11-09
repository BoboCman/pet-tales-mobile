"use client"

import { useEffect } from "react"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Tales made before poster frames existed have no thumbnail on the My tales grid. When the owner
 * opens such a tale, grab one frame from the video in a hidden element (after the main player has
 * had a head start) and save it, so the grid shows a real picture from then on. Silent on failure.
 */
export function PosterBackfill({ taleId, videoUrl }: { taleId: string; videoUrl: string | null | undefined }) {
  useEffect(() => {
    if (!SUPABASE_URL || !videoUrl) return
    const key = `poster-tried-${taleId}`
    try {
      if (sessionStorage.getItem(key)) return
    } catch {}

    let cancelled = false
    let video: HTMLVideoElement | null = null
    const posterUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/thumbnails/pet-tale-${taleId}.jpg`

    const finish = () => {
      if (video) {
        video.removeAttribute("src")
        video.remove()
      }
      video = null
    }

    const grabFrame = () => {
      // One try per tale per session
      try {
        sessionStorage.setItem(key, "1")
      } catch {}
      video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.muted = true
      video.playsInline = true
      video.preload = "auto"
      video.src = videoUrl
      // Some browsers only decode frames for a video that is in the page
      video.setAttribute("aria-hidden", "true")
      video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none"
      document.body.appendChild(video)
      video.addEventListener("loadedmetadata", () => {
        if (!video) return
        video.currentTime = Math.min(1, (video.duration || 2) / 3)
      })
      const capture = () => {
        if (!video || cancelled) return
        try {
          const width = Math.min(720, video.videoWidth || 720)
          const height = Math.round(width * ((video.videoHeight || 1280) / (video.videoWidth || 720)))
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) return finish()
          ctx.drawImage(video, 0, 0, width, height)
          // Skip a blank frame (not decoded yet) rather than save a black poster
          const px = ctx.getImageData(0, 0, width, height).data
          let lit = 0
          for (let i = 0; i < px.length; i += 4 * 97) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++
          if (lit < 20) return finish()
          canvas.toBlob(
            (blob) => {
              if (blob && !cancelled) {
                fetch(`/api/reels/${taleId}/poster`, { method: "POST", body: blob, headers: { "Content-Type": "image/jpeg" } }).catch(() => {})
              }
              finish()
            },
            "image/jpeg",
            0.82,
          )
        } catch {
          // The video host didn't allow reading frames; nothing to do
          finish()
        }
      }
      video.addEventListener("seeked", () => {
        // Give the seeked frame a moment to be painted (requestVideoFrameCallback doesn't fire
        // for a paused video in every browser), then grab it once
        let done = false
        const once = () => {
          if (done) return
          done = true
          capture()
        }
        const v = video as any
        if (v && typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(once)
        setTimeout(once, 500)
      })
      video.load()
    }

    // Only make the poster if there isn't one yet
    const probe = new Image()
    probe.onerror = () => {
      if (!cancelled) setTimeout(() => !cancelled && grabFrame(), 4000)
    }
    probe.src = posterUrl

    return () => {
      cancelled = true
      finish()
    }
  }, [taleId, videoUrl])

  return null
}
