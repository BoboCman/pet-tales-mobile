"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Poster URL saved by the merge step (or PosterBackfill) for a finished tale */
export { talePosterUrl } from "@/lib/tale-poster-url"

// Soft gradients for tales with no poster yet, picked per pet so the grid stays varied
const FALLBACK_GRADIENTS = [
  "from-teal-500 to-emerald-700",
  "from-amber-400 to-orange-600",
  "from-sky-500 to-indigo-700",
  "from-rose-400 to-fuchsia-700",
  "from-lime-500 to-green-700",
  "from-violet-500 to-purple-800",
]

/**
 * Poster frame of a finished tale, or a gradient when there is none yet. Never loads the video:
 * a grid of video previews downloads every tale and makes the page sluggish. Older tales get a
 * poster the first time they are opened (see PosterBackfill).
 */
export function TalePoster({ tale }: { tale: { posterUrl: string | null; petName: string } }) {
  const [failed, setFailed] = useState(!tale.posterUrl)
  const imgRef = useRef<HTMLImageElement>(null)
  // A poster that failed before hydration never fires onError in React, so check once mounted
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  if (!failed) {
    return (
      <img
        ref={imgRef}
        src={tale.posterUrl!}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }
  const seed = [...(tale.petName || "pet")].reduce((n, c) => n + c.charCodeAt(0), 0)
  return (
    <div className={cn("absolute inset-0 bg-gradient-to-br", FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length])} />
  )
}

export function PetAvatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-[10px] font-bold text-teal-700",
        className,
      )}
    >
      {image && !broken ? (
        <img src={image} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  )
}

