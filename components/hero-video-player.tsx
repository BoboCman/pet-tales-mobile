"use client"

import { useState, useRef } from "react"
import { Play } from "lucide-react"

interface HeroVideoPlayerProps {
  src: string
  poster: string
  ariaLabel: string
}

export function HeroVideoPlayer({ src, poster, ariaLabel }: HeroVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  return (
    <div className="relative aspect-[9/16] mx-auto w-full overflow-hidden rounded-3xl bg-gray-100 shadow-2xl shadow-teal-900/20 ring-1 ring-black/5 dark:bg-gray-800">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover object-[62%_center] cursor-pointer"
        poster={poster}
        playsInline
        preload="metadata"
        aria-label={ariaLabel}
        onClick={handleVideoClick}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Play button overlay */}
      {!isPlaying && (
        <button
          onClick={handlePlayClick}
          className="hero-video-play-button absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer group"
          aria-label="Play video"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
            <Play className="w-8 h-8 text-teal-600 ml-1" fill="currentColor" />
          </div>
        </button>
      )}
    </div>
  )
}
