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
      <div className="space-y-4">
        {/* Watch a Tale button */}
        <Button
          onClick={handleWatchTale}
          variant="outline"
          size="lg"
          className="w-full h-14 px-8 text-lg border-2 border-teal-600 text-teal-600 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/20 transition-all bg-transparent"
        >
          ▶️ Watch a Tale
        </Button>

        {/* Start Free box */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/30 dark:to-emerald-950/30 border-2 border-teal-200 dark:border-teal-700 rounded-xl px-6 py-5">
          <div className="text-center lg:text-left">
            <p className="text-teal-900 dark:text-teal-100 font-bold text-lg mb-2 flex items-center justify-center lg:justify-start gap-2">
              <span className="text-2xl">🎁</span>
              Start Free
            </p>
            <p className="text-teal-800 dark:text-teal-200 text-base mb-3">
              <span className="font-semibold">3 free tales when you join + 1 new free tale every week.</span>
            </p>
            <p className="text-teal-700 dark:text-teal-300 text-sm">
              Pick a voice that matches their personality — playful, sweet, sassy, or wise. You'll know it when you hear
              it.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 text-lg bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <Link href={isLoggedIn ? "/dashboard/pets/new" : "/auth/signup"}>Try It Free</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 px-8 text-lg border-2 border-gray-300 hover:border-teal-600 hover:text-teal-600 dark:border-gray-700 dark:hover:border-teal-500 transition-all bg-transparent"
          >
            <Link href="/community/public">Watch More Examples</Link>
          </Button>
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
