"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart, Eye, Play, ExternalLink, Share2, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPublicUrl } from "@/lib/supabase/url-utils"
import { recordPublicViewClient, togglePublicLikeClient } from "@/lib/api/engagement"
import { getSessionId, hasLikedTale, toggleTaleLike } from "@/lib/session/client-session"
import { useToast } from "@/hooks/use-toast"
import { getVoiceByValue } from "@/lib/voice-personalities"
import { NARRATION_GENRES } from "@/lib/narration-genres"
import { useSaveToPhone } from "@/components/reels/use-save-to-phone"

interface PublicTale {
  id: string
  title: string | null
  content: string | null
  mood: string | null
  image_url: string | null
  video_url: string | null
  optimized_video_url: string | null
  merged_video_url: string | null
  narration_style: string | null
  narration_genre: string | null
  created_at: string
  view_count: number | null
  like_count: number | null
  pets: {
    id: string
    name: string
    breed: string | null
    type: string | null
    avatar_url: string | null
    photo_url: string | null
    image_url: string | null
  } | null
}

interface PublicTaleViewerProps {
  tale: PublicTale
}

const processImageUrl = (url: string | null) => {
  if (!url) return null
  if (url.startsWith("http")) return url
  return getPublicUrl(url)
}

export function PublicTaleViewer({ tale }: PublicTaleViewerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()
  const [showShareSheet, setShowShareSheet] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)
  const [hasFirstFrame, setHasFirstFrame] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [hasRecordedView, setHasRecordedView] = useState(false)

  const [viewCount, setViewCount] = useState(tale.view_count || 0)
  const [likeCount, setLikeCount] = useState(tale.like_count || 0)
  const [isLiked, setIsLiked] = useState(hasLikedTale(tale.id))
  const [isLiking, setIsLiking] = useState(false)

  const videoUrl = tale.merged_video_url || tale.optimized_video_url || tale.video_url
  const petName = tale.pets?.name || "Unknown Pet"
  const petType = tale.pets?.type || "pet"

  const voiceLabel = tale.narration_style
    ? getVoiceByValue(tale.narration_style)?.label || tale.narration_style
    : "Voice"
  const vibeLabel = tale.narration_genre
    ? NARRATION_GENRES.find((g) => g.value === tale.narration_genre)?.label || tale.narration_genre
    : "Vibe"

  const taleUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/community/public/${tale.id}`
      : `https://www.pettaleai.com/community/public/${tale.id}`

  // The bottom nav hides itself on this route (see isHiddenOn in components/layout/bottom-nav.tsx)

  useEffect(() => {
    const video = videoRef.current

    if (video) {
      const playVideo = async () => {
        try {
          video.muted = false
          video.volume = 1
          ;(video as any).webkitPlaysInline = true

          await video.play()
          setIsPlaying(true)
          setHasEnded(false)
          setTimeout(() => setShowControls(false), 3000)
        } catch (error) {
          console.error("Video play failed:", error)
          setIsLoading(false)
        }
      }

      const timer = setTimeout(playVideo, 100)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setIsPlaying(true)
      setHasEnded(false)
    }
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setHasEnded(true)
      setShowControls(true)
      setTimeout(() => setShowEndModal(true), 500)
    }
    const handleReady = () => {
      setHasFirstFrame(true)
      setIsLoading(false)
      recordView()
    }

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("ended", handleEnded)
    video.addEventListener("loadeddata", handleReady)
    video.addEventListener("canplay", handleReady)
    video.addEventListener("playing", handleReady)

    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("ended", handleEnded)
      video.removeEventListener("loadeddata", handleReady)
      video.removeEventListener("canplay", handleReady)
      video.removeEventListener("playing", handleReady)
    }
  }, [])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      setShowControls(true)
    } else {
      if (hasEnded) {
        video.currentTime = 0
        setHasEnded(false)
        setShowEndModal(false)
      }

      video.muted = false
      video.volume = 1
      setIsLoading(true)

      video
        .play()
        .then(() => {
          setIsPlaying(true)
          setTimeout(() => setShowControls(false), 3000)
        })
        .catch(console.error)
    }
  }

  const handleVideoTap = () => {
    togglePlayPause()
  }

  const handleLike = async () => {
    if (isLiking) return

    setIsLiking(true)
    try {
      const sessionId = getSessionId()
      const result = await togglePublicLikeClient(tale.id, sessionId)

      if (result.success) {
        if (result.likeCount !== undefined) {
          setLikeCount(result.likeCount)
        }
        if (result.liked !== undefined) {
          setIsLiked(result.liked)
          toggleTaleLike(tale.id)
        }

        toast({
          title: result.liked ? "Tale liked!" : "Like removed",
          description: result.liked ? "Thanks for showing some love!" : "Tale unliked",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update like",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to like tale",
        variant: "destructive",
      })
    } finally {
      setIsLiking(false)
    }
  }

  const handleShareTo = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: tale.title || "Check out this Pet Tale!",
          text: `Watch ${petName}'s tale on Pet Tale AI`,
          url: taleUrl,
        })
      }
    } catch (error) {
      console.error("Error sharing:", error)
    } finally {
      setShowShareSheet(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(taleUrl)
      toast({
        title: "Link copied!",
        description: "Tale link copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    } finally {
      setShowShareSheet(false)
    }
  }

  // Save = the "for socials" copy (title + pettaleai.com burned in), the same flow as private tales:
  // iPhone share sheet -> Save Video, Android/desktop download. Made on the first save, then reused.
  const saver = useSaveToPhone({
    entryId: tale.id,
    filenameHint: `${petName}-${tale.title || "Pet Tale"}`.replace(/[^a-zA-Z0-9-]/g, "-"),
    canSave: !!tale.merged_video_url,
    onFallbackDownload: () => {
      if (tale.merged_video_url) window.open(tale.merged_video_url, "_blank", "noopener")
    },
    variant: "social",
  })

  const handleWatchAgain = () => {
    const video = videoRef.current
    if (!video) return

    setShowEndModal(false)
    setHasEnded(false)
    video.currentTime = 0
    video
      .play()
      .then(() => {
        setIsPlaying(true)
      })
      .catch(console.error)
  }

  const handleGoToSignup = () => {
    window.location.href = "https://www.pettaleai.com/auth/signup"
  }

  const recordView = async () => {
    if (hasRecordedView) return

    try {
      console.log(`📊 Recording view for public tale ${tale.id} via unified API`)

      const result = await recordPublicViewClient(tale.id)

      if (result.success && result.viewCount !== undefined) {
        setViewCount(result.viewCount)
        setHasRecordedView(true)
        console.log(`📊 Public view recorded via unified API for tale ${tale.id}`)
      }
    } catch (error) {
      console.error("Failed to record public view:", error)
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
      {!showEndModal && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/20">
              <ArrowLeft className="h-6 w-6" />
            </Button>

            <div className="flex-1 text-center">
              <h1 className="text-white font-semibold text-lg truncate px-4">{tale.title || "Untitled Tale"}</h1>
              <p className="text-sm text-white/80">
                {voiceLabel} • {vibeLabel}
              </p>
            </div>

            <div className="w-10 h-10"></div>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex items-center justify-center max-w-lg mx-auto w-full">
        {!hasFirstFrame && <div className="absolute inset-0 bg-black z-10" />}

        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          playsInline
          onTouchEnd={handleVideoTap}
          onClick={handleVideoTap}
        />

        {!showEndModal && showControls && (!isPlaying || hasEnded) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/30 rounded-full p-4 pointer-events-auto" onClick={togglePlayPause}>
              <Play className="h-12 w-12 text-white" />
            </div>
          </div>
        )}
      </div>

      {showEndModal && (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">🐾</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Loved this tale?</h2>
            <p className="text-gray-600 mb-6">Create your own AI-powered pet stories with Pet Tale AI</p>

            <Button
              onClick={handleGoToSignup}
              className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl mb-4 transition-all duration-200 transform hover:scale-105"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Create Your Free Account
            </Button>

            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                onClick={handleWatchAgain}
                className="flex-1 text-sm bg-transparent hover:bg-gray-50"
              >
                Watch Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowEndModal(false)}
                className="flex-1 text-sm hover:bg-gray-100"
              >
                Close
              </Button>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-gray-500 mb-1">
                Powered by <span className="font-semibold text-teal-600">Pet Tale AI</span>
              </p>
              <p className="text-xs text-gray-400">© {new Date().getFullYear()} Glendale AI, LLC. All rights reserved.</p>
            </div>
          </div>
        </div>
      )}

      {!showEndModal && (
        <div className="absolute right-4 bottom-40 flex flex-col gap-6 z-20">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <Eye className="h-7 w-7 text-white" />
            </div>
            <span className="text-white text-xs mt-1 font-medium">{viewCount}</span>
          </div>

          <button onClick={handleLike} disabled={isLiking} className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center ${
                isLiked ? "bg-red-500" : "bg-black/30"
              }`}
            >
              <Heart className={`h-7 w-7 text-white ${isLiked ? "fill-current" : ""}`} />
            </div>
            <span className="text-white text-xs mt-1 font-medium">{likeCount}</span>
          </button>

          <button onClick={() => setShowShareSheet(true)} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <Share2 className="h-7 w-7 text-white" />
            </div>
          </button>

          {tale.merged_video_url && (
            <button
              onClick={saver.save}
              disabled={saver.state === "preparing"}
              aria-label={saver.isIOS ? "Save to Photos" : "Save video"}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                {saver.state === "preparing" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Download className="h-7 w-7 text-white" />
                )}
              </div>
              <span className="text-white text-xs mt-1 font-medium">
                {saver.state === "preparing" ? "Making…" : "Save"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* The video finished after the tap expired: one more tap opens the share sheet (iPhone) */}
      {saver.state === "ready-to-tap" && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={saver.cancelReady}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-gray-900">This tale is ready to save</p>
            <p className="mt-1 text-sm text-gray-500">Tap below, then choose &ldquo;Save Video&rdquo;.</p>
            <button
              type="button"
              onClick={saver.saveReady}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[15px] font-semibold text-white active:bg-teal-700"
            >
              <Download className="h-5 w-5" />
              Save to Photos
            </button>
            <button type="button" onClick={saver.cancelReady} className="mt-2 h-11 w-full text-sm font-medium text-gray-500">
              Not now
            </button>
          </div>
        </div>
      )}

      {showShareSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
          onClick={() => setShowShareSheet(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleShareTo}
                className="w-full p-4 text-center text-lg font-medium rounded-lg hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                Share to...
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full p-4 text-center text-lg font-medium rounded-lg hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShowShareSheet(false)}
                className="w-full p-4 text-center text-lg font-medium text-gray-500 rounded-lg hover:bg-gray-50 transition-colors active:bg-gray-100 mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
