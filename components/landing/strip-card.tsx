"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Play } from "lucide-react"
import { TalePoster } from "@/components/reels/tale-poster"
import { recordPublicViewClient } from "@/lib/api/engagement"

const PLAY_EVENT = "strip-card-play"

/**
 * A Community tale on the home page. Shows only the poster until tapped, then loads and plays the
 * video right in the card (one at a time). Counts as a Community view, like opening the tale.
 */
export function StripCard({
  id,
  title,
  petName,
  posterUrl,
  videoUrl,
}: {
  id: string
  title: string
  petName: string
  posterUrl: string | null
  videoUrl: string | null
}) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const viewed = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Starting one card pauses any other
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== id) videoRef.current?.pause()
    }
    window.addEventListener(PLAY_EVENT, onOther)
    return () => window.removeEventListener(PLAY_EVENT, onOther)
  }, [id])

  const start = () => {
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }))
    if (!active) {
      setActive(true)
      if (!viewed.current) {
        viewed.current = true
        recordPublicViewClient(id).catch(() => {})
      }
      return
    }
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const content = (
    <>
      {active && videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl ?? undefined}
          autoPlay
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <TalePoster tale={{ posterUrl, petName }} />
      )}
      {!playing && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{title}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/75">{petName}</p>
          </div>
        </>
      )}
    </>
  )

  const cardClass =
    "relative block aspect-[9/16] w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-gray-200 shadow-sm sm:w-48"

  // No playable file: fall back to opening the tale page
  if (!videoUrl) {
    return (
      <Link href={`/community/public/${id}`} className={cardClass}>
        {content}
      </Link>
    )
  }

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={start}
        aria-label={playing ? `Pause ${title}` : `Play ${title}`}
        className="absolute inset-0 h-full w-full"
      >
        {content}
      </button>
      {active && (
        <Link
          href={`/community/public/${id}`}
          aria-label={`Open ${title}`}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
