"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart, Share2, Eye, Play, Lock, Globe, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPublicUrl } from "@/lib/supabase/url-utils"
import { useToast } from "@/hooks/use-toast"
import { getVoiceByValue } from "@/lib/voice-personalities"
import { NARRATION_GENRES } from "@/lib/narration-genres"

interface DiaryEntry {
  id: string
  title: string | null
  content: string | null
  mood: string | null
  video_url: string | null
  optimized_video_url: string | null
  merged_video_url: string | null // Existing - Cloudinary URL for UI
  merged_video_supabase_url: string | null // NEW - Supabase URL for sharing
  voiceover_url: string | null
  created_at: string
  view_count: number | null
  like_count: number | null
  is_public: boolean | null
  narration_style: string | null // Added for voice personality
  narration_genre: string | null // Added for storytelling vibe
  pets: {
    id: string
    name: string
    type: string
    avatar_url: string | null
    photo_url: string | null
    image_url: string | null
  } | null
}

interface MobileReelDetailProps {
  reel: DiaryEntry
  isLiked: boolean
  likeCount: number
  viewCount: number
  onLike: () => void
  onShare: () => void
  onDownload?: () => void
  onShareFile?: () => void
  supportsFileShare?: boolean
  isSharingFile?: boolean
  isLiking: boolean
  hasRecordedView: boolean
  onTogglePublic?: () => void
  isTogglingPublic?: boolean
  isDownloading?: boolean
}

// Helper function to safely process image URLs
const processImageUrl = (url: string | null) => {
  if (!url) return null

  // If already a complete URL, use as-is
  if (url.startsWith("http")) return url

  // Otherwise, it's a storage path - process it
  return getPublicUrl(url)
}

export function MobileReelDetail({
  reel,
  isLiked,
  likeCount,
  viewCount,
  onLike,
  onShare,
  onDownload,
  onShareFile,
  supportsFileShare = false,
  isSharingFile = false,
  isLiking,
  hasRecordedView,
  onTogglePublic,
  isTogglingPublic = false,
  isDownloading = false,
}: MobileReelDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const videoUrl = reel.merged_video_url || reel.optimized_video_url || reel.video_url
  const petName = reel.pets?.name || "Unknown Pet"
  const petType = reel.pets?.type || "pet"

  // Use the helper function to safely process pet image URLs
  const petAvatar = processImageUrl(reel.pets?.avatar_url)
  const petPhoto = processImageUrl(reel.pets?.photo_url)
  const petImage = processImageUrl(reel.pets?.image_url)

  const petImageUrl = petAvatar || petPhoto || petImage || `/placeholder.svg?height=96&width=96&query=${petType}`

  const voicePersonality = reel.narration_style ? getVoiceByValue(reel.narration_style) : null
  const vibeGenre = reel.narration_genre ? NARRATION_GENRES.find((g) => g.value === reel.narration_genre) : null

  const voiceLabel = voicePersonality?.label || "Unknown Voice"
  const vibeLabel = vibeGenre?.label || "Unknown Vibe"

  const hasDownloadableVideo = !!reel.merged_video_supabase_url

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return

    console.log("[v0] Initializing video:", videoUrl.substring(0, 100))

    video.load()

    const handleCanPlay = () => {
      console.log("[v0] Video can play - hiding loader")
      setIsLoading(false)

      video
        .play()
        .then(() => {
          console.log("[v0] Video playing")
          setIsPlaying(true)
          hideControlsAfterDelay()
        })
        .catch((err) => {
          console.error("[v0] Autoplay failed:", err)
          setIsLoading(false)
        })
    }

    const handlePlay = () => {
      console.log("[v0] Video playing")
      setIsPlaying(true)
      setHasEnded(false)
      hideControlsAfterDelay()
    }

    const handlePause = () => {
      console.log("[v0] Video paused")
      setIsPlaying(false)
      setShowControls(true)
      clearControlsTimeout()
    }

    const handleEnded = () => {
      console.log("[v0] Video ended")
      setIsPlaying(false)
      setHasEnded(true)
      setShowControls(true)
      clearControlsTimeout()
    }

    const handleWaiting = () => {
      console.log("[v0] Video buffering")
      setIsLoading(true)
    }

    const handlePlaying = () => {
      console.log("[v0] Video playing after buffer")
      setIsLoading(false)
    }

    const handleError = (e: Event) => {
      console.error("[v0] Video error:", e)
      setIsLoading(false)
      toast({
        title: "Video Error",
        description: "Failed to load video. Please try again.",
        variant: "destructive",
      })
    }

    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("ended", handleEnded)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("error", handleError)

    return () => {
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("ended", handleEnded)
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("playing", handlePlaying)
      video.removeEventListener("error", handleError)
      clearControlsTimeout()
    }
  }, [videoUrl, toast])

  const hideControlsAfterDelay = () => {
    clearControlsTimeout()
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  const clearControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
      controlsTimeoutRef.current = null
    }
  }

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch((err) => {
        console.error("[v0] Play error:", err)
        toast({
          title: "Playback Error",
          description: "Unable to play video",
          variant: "destructive",
        })
      })
    }
  }

  const handleVideoTap = () => {
    if (showControls) {
      togglePlayPause()
    } else {
      setShowControls(true)
      hideControlsAfterDelay()
    }
  }

  if (!videoUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-lg mb-4">Video not available</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/20">
            <ArrowLeft className="h-6 w-6" />
          </Button>

          <div className="flex-1 text-center">
            <h1 className="text-white font-semibold text-lg truncate px-4">{reel.title || "Untitled Tale"}</h1>
            <p className="text-sm text-white/80">
              {voiceLabel} • {vibeLabel}
            </p>
          </div>

          {/* Empty space to balance the layout */}
          <div className="w-10 h-10"></div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePublic}
            disabled={isTogglingPublic}
            className={`text-sm px-4 py-2 h-9 ${
              reel.is_public
                ? "bg-teal-600/80 hover:bg-teal-700/80 text-white"
                : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
            }`}
          >
            {isTogglingPublic ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
            ) : reel.is_public ? (
              <Globe className="h-4 w-4 mr-2" />
            ) : (
              <Lock className="h-4 w-4 mr-2" />
            )}
            {reel.is_public ? "Public" : "Post to Community"}
          </Button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          playsInline
          preload="auto"
          onClick={handleVideoTap}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleVideoTap()
          }}
        />

        {/* Play/Pause overlay */}
        {showControls && (!isPlaying || hasEnded) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/30 rounded-full p-4 pointer-events-auto cursor-pointer" onClick={togglePlayPause}>
              <Play className="h-12 w-12 text-white" />
            </div>
          </div>
        )}
      </div>

      <div className="absolute right-4 bottom-40 flex flex-col gap-6 z-20">
        {/* Views - icon only with count */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Eye className="h-7 w-7 text-white" />
          </div>
          <span className="text-white text-xs mt-1 font-medium">{viewCount}</span>
        </div>

        {/* Likes - icon only with count */}
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onLike}
            disabled={isLiking}
            className={`w-12 h-12 rounded-full backdrop-blur-sm ${
              isLiked ? "bg-red-500 hover:bg-red-600 text-white" : "bg-black/30 hover:bg-black/50 text-white"
            }`}
          >
            <Heart className={`h-7 w-7 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <span className="text-white text-xs mt-1 font-medium">{likeCount}</span>
        </div>

        {/* Share - icon only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onShare}
          className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white"
        >
          <Share2 className="h-7 w-7" />
        </Button>

        {/* Download - icon only */}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload}
            disabled={isDownloading || !hasDownloadableVideo}
            className={`w-12 h-12 rounded-full backdrop-blur-sm hover:bg-black/50 text-white ${
              !hasDownloadableVideo ? "bg-black/20 text-white/50" : "bg-black/30"
            }`}
            title={!hasDownloadableVideo ? "Video not ready yet." : undefined}
          >
            {isDownloading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            ) : (
              <Download className="h-7 w-7" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
