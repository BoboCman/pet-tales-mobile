"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Play, X } from "lucide-react"

interface HeroActionButtonsProps {
  isLoggedIn: boolean
}

export function HeroActionButtons({ isLoggedIn }: HeroActionButtonsProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [showMobilePlayer, setShowMobilePlayer] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleWatchTale = () => {
    if (isMobile) {
      setShowMobilePlayer(true)
    } else {
      // Desktop: scroll to video and play
      const videoSection = document.querySelector(".hero-video-section")
      if (videoSection) {
        videoSection.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => {
          const playButton = document.querySelector(".hero-video-play-button") as HTMLButtonElement
          if (playButton) playButton.click()
        }, 500)
      }
    }
  }

  const handlePlayVideo = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      video.muted = false
      video.volume = 1
      await video.play()
      setIsPlaying(true)
    } catch (error) {
      console.error("Video play failed:", error)
    }
  }

  const handleVideoTap = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await handlePlayVideo()
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const closePlayer = () => {
    const video = videoRef.current
    if (video) {
      video.pause()
    }
    setIsPlaying(false)
    setShowMobilePlayer(false)
  }

  return (
    <>
      <div className="space-y-3">
        <Button
          asChild
          size="lg"
          className="w-full sm:w-auto h-14 px-10 text-lg font-semibold bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-xl transition-all"
        >
          <Link href={isLoggedIn ? "/dashboard/reels/new" : "/auth/signup"}>
            {isLoggedIn ? "Make a Tale" : "Make Your First Tale Free"}
          </Link>
        </Button>
        <div>
          <button
            type="button"
            onClick={handleWatchTale}
            className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-medium hover:underline"
          >
            <Play className="w-4 h-4" fill="currentColor" /> Watch an example
          </button>
        </div>
      </div>

      {/* Mobile Fullscreen Video Player */}
      {showMobilePlayer && (
        <div
          className="fixed inset-0 bg-black z-[10000] flex flex-col"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent pt-12 px-4 pb-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={closePlayer} className="text-white hover:bg-white/20">
                <X className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-white font-semibold text-lg">Russel's Brave Hammock Quest</h1>
                <p className="text-white/70 text-sm">Baby Talk · Heartfelt</p>
              </div>
            </div>
          </div>

          {/* Video */}
          <div className="flex-1 flex items-center justify-center">
            <video
              ref={videoRef}
              src="https://www.pettaleai.com/video/e94325a5-8745-4ee3-b757-5334f2a8497e.mp4"
              className="w-full h-full object-contain"
              playsInline
              poster="https://puxgwsckuwaahdyqwemq.supabase.co/storage/v1/object/public/pet-photo/043ab6db-d66f-4b4a-b327-ddf7220c7e14.jpeg"
              onClick={handleVideoTap}
              onTouchEnd={(e) => {
                e.preventDefault()
                handleVideoTap()
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Play button overlay */}
            {!isPlaying && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePlayVideo()
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handlePlayVideo()
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/30"
              >
                <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="w-10 h-10 text-teal-600 ml-1" fill="currentColor" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
