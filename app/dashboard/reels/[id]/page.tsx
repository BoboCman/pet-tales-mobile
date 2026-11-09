"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Share2, Lock, Download, Copy, Info, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { MobileReelDetail } from "@/components/reels/mobile-reel-detail"
import { PosterBackfill } from "@/components/reels/poster-backfill"
import { useMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"
import { getPublicUrl } from "@/lib/supabase/url-utils"
import { getPetTalesShareUrl } from "@/lib/utils/pet-tales-urls"
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
  liked_by: string[] | null
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

// Helper function to safely process image URLs
const processImageUrl = (url: string | null) => {
  if (!url) return null

  // If already a complete URL, use as-is
  if (url.startsWith("http")) return url

  // Otherwise, it's a storage path - process it
  return getPublicUrl(url)
}

const normalizeShareUrl = (url: string): string => {
  // If already absolute with protocol, use as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Collapse any double slashes in the path (but preserve the protocol)
    return url.replace(/([^:]\/)\/+/g, "$1")
  }

  // If protocol-relative, add https:
  if (url.startsWith("//")) {
    return `https:${url}`.replace(/([^:]\/)\/+/g, "$1")
  }

  // If looks like bare domain (contains . and doesn't start with /), add https://
  if (url.includes(".") && !url.startsWith("/")) {
    const cleanUrl = url.startsWith("/") ? url.substring(1) : url
    return `https://${cleanUrl}`.replace(/([^:]\/)\/+/g, "$1")
  }

  // If app-relative (starts with /), prefix with origin
  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`.replace(/([^:]\/)\/+/g, "$1")
  }

  // Otherwise, resolve against origin
  try {
    return new URL(url, window.location.origin).toString().replace(/([^:]\/)\/+/g, "$1")
  } catch {
    // Fallback if URL construction fails
    return `${window.location.origin}/${url}`.replace(/([^:]\/)\/+/g, "$1")
  }
}

// Constants for file sharing limits
const FILE_SHARE_FETCH_TIMEOUT_MS = 45000 // Increased from 30000
const FILE_SHARE_MAX_BYTES = 200 * 1024 * 1024 // 200MB

export default function ReelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const isMobile = useMobile()
  const { toast } = useToast()
  const [reel, setReel] = useState<DiaryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const [hasRecordedView, setHasRecordedView] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [supportsFileShare, setSupportsFileShare] = useState(false)
  const [isSharingFile, setIsSharingFile] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false) // Add state for confirmation modal

  const reelId = params.id as string

  useEffect(() => {
    const detectWebShareCapabilities = async () => {
      // Only run client-side in secure context
      if (typeof window === "undefined" || !window.isSecureContext) {
        console.info("feature_probe:web_share_files", { supportsFileShare: false, reason: "not_secure_context" })
        return
      }

      try {
        // Test file creation and Web Share Level 2 support
        const testFile = new File(["x"], "x.txt", { type: "application/json" })

        const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [testFile] }))

        setSupportsFileShare(canShareFiles)
        console.info("feature_probe:web_share_files", { supportsFileShare: canShareFiles })

        // Optional: Test blob → file construction with a small test
        try {
          const testBlob = new Blob(["test"], { type: "application/json" })
          const _testFileFromBlob = new File([testBlob], "test.txt", { type: "application/json" })
          void _testFileFromBlob // ensure no-unused-vars stays quiet in strict configs
          console.info("feature_probe:file_construct_ok", { ok: true })
        } catch (fileErr) {
          const msg = fileErr instanceof Error ? fileErr.message : String(fileErr)
          console.info("feature_probe:file_construct_ok", { ok: false, error: msg })
        }

        // Optional: Report to analytics (lightweight telemetry)
        const uaSnippet = navigator.userAgent.substring(0, 100)
        const platformHint = /iPhone|iPad|iPod/.test(navigator.userAgent)
          ? "ios"
          : /Android/.test(navigator.userAgent)
            ? "android"
            : "desktop"

        console.info("feature_probe:telemetry", {
          supportsFileShare: canShareFiles,
          uaSnippet,
          platformHint,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.info("feature_probe:web_share_files", { supportsFileShare: false, error: msg })
      }
    }

    detectWebShareCapabilities()
  }, [])

  useEffect(() => {
    const fetchReel = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/diary/entries?scope=all", {
          credentials: "include",
        })

        if (!response.ok) {
          setError("Failed to fetch tale")
          return
        }

        const result = await response.json()

        if (!result.success) {
          setError(result.error || "Failed to fetch tale")
          return
        }

        if (!Array.isArray(result.entries)) {
          setError("Invalid data format received")
          return
        }

        const foundReel = result.entries.find((entry) => entry.id === reelId)

        if (!foundReel) {
          setError("Pet tale not found")
          return
        }

        // Ensure the reel has video content
        if (!foundReel.merged_video_url && !foundReel.optimized_video_url && !foundReel.video_url) {
          setError("No video content available for this tale")
          return
        }

        setReel(foundReel)
        setLikeCount(foundReel.like_count || 0)
        setViewCount(foundReel.view_count || 0)

        // Check if current user has liked this entry
        // TODO: Implement proper user like status check
        setIsLiked(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("Error fetching reel:", msg)
        setError("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    if (reelId) {
      fetchReel()
    }
  }, [reelId])

  useEffect(() => {
    const recordView = async () => {
      if (reel && !hasRecordedView) {
        try {
          console.log(`Recording view for reel ${reel.id}. Current count: ${viewCount}`)

          const response = await fetch("/api/engagement/view", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              entryId: reel.id,
              entryType: "diary_entry",
            }),
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success && result.viewCount) {
              setViewCount(result.viewCount)
              setHasRecordedView(true)
              console.log(`✅ View recorded successfully. New count: ${result.viewCount}`)
            } else {
              console.error("❌ Failed to record view:", result.error)
            }
          } else {
            console.error("❌ Failed to record view: HTTP", response.status)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error("❌ Error recording view:", msg)
        }
      }
    }

    recordView()
  }, [reel, hasRecordedView, viewCount])

  useEffect(() => {
    return () => {
      // Cleanup function - explicitly do nothing to prevent additional view recording
      console.log(`🚪 Leaving reel ${reelId} - no additional view recording`)
    }
  }, [reelId])

  const handleLike = async () => {
    if (!reel || isLiking) return

    setIsLiking(true)
    try {
      const response = await fetch("/api/engagement/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          entryId: reel.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setIsLiked(result.liked || false)
          setLikeCount(result.likeCount || likeCount)
          toast({
            title: result.liked ? "Liked!" : "Removed like",
            description: result.liked ? "You liked this tale" : "You unliked this tale",
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to update like",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to update like",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLiking(false)
    }
  }

  const handleTogglePublic = async (skipConfirmation = false) => {
    if (!reel || isTogglingPublic) return

    // If making private and no skip confirmation, show modal
    if (reel.is_public && !skipConfirmation) {
      setShowConfirmModal(true)
      return
    }

    setIsTogglingPublic(true)
    try {
      const response = await fetch("/api/reels/toggle-public", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          entryId: reel.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setReel((prev) => (prev ? { ...prev, is_public: result.isPublic } : null))

          toast({
            title: result.isPublic ? "Video shared with community! 🎉" : "Video is now private 🔒", // Updated toast title
            description: result.isPublic
              ? "Everyone can now view and enjoy your tale!" // Updated description
              : "Your tale has been removed from the community feed.", // Updated description
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to update community sharing",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to update community sharing",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsTogglingPublic(false)
      setShowConfirmModal(false) // Close modal on completion
    }
  }

  const confirmMakePrivate = () => {
    handleTogglePublic(true)
  }

  const handleShare = async () => {
    if (!reel) return

    const petName = reel.pets?.name || "Unknown Pet"

    try {
      let shareUrl: string
      let urlType: string

      // Check if we have a Supabase URL for proper transformation detection
      if (reel.merged_video_supabase_url) {
        // Store the original Supabase URL for comparison
        const originalSupabaseUrl = reel.merged_video_supabase_url

        // Try to convert to Pet Tales AI URL
        const transformedUrl = getPetTalesShareUrl(originalSupabaseUrl)

        // Detect transformation success by comparing URLs
        const isPetTalesTransformation = transformedUrl !== originalSupabaseUrl

        if (isPetTalesTransformation) {
          // Transformation succeeded - use Pet Tales AI URL
          shareUrl = transformedUrl
          urlType = "Pet Tales AI"
        } else {
          // Transformation failed - use original Supabase URL
          shareUrl = originalSupabaseUrl
          urlType = "Supabase"
        }
      } else {
        // No Supabase URL available - use existing fallback logic
        const fallbackVideoUrl = reel.merged_video_url || reel.optimized_video_url || reel.video_url

        // Validate that a video URL exists
        if (!fallbackVideoUrl) {
          toast({
            title: "No video available",
            description: "This tale doesn't have a video to share yet",
            variant: "destructive",
          })
          return
        }

        // Try Pet Tales AI conversion with fallback URL
        const transformedUrl = getPetTalesShareUrl(fallbackVideoUrl)
        const isPetTalesTransformation = transformedUrl !== fallbackVideoUrl

        shareUrl = transformedUrl
        urlType = isPetTalesTransformation ? "Pet Tales AI" : "original"
      }

      // Share the tale page, not the bare video file: the page shows a preview card in chats and
      // feeds, plays the tale, and invites the viewer to make their own. The video file link
      // (shareUrl) is still what "Download" uses.
      const normalizedUrl = reel.merged_video_supabase_url
        ? `${window.location.origin}/tale/${reel.id}`
        : normalizeShareUrl(shareUrl)
      console.log(`🔗 Sharing ${urlType} video: ${shareUrl} → ${normalizedUrl}`)

      if (navigator.share) {
        // Create a promise that resolves when user makes a choice
        const userChoice = await new Promise<"share" | "copy" | "cancel">((resolve) => {
          // Create overlay and action sheet
          const overlay = document.createElement("div")
          overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 16px;
            animation: fadeIn 0.2s ease-out;
          `

          const sheet = document.createElement("div")
          sheet.style.cssText = `
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 500px;
            padding: 8px;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
            animation: slideUp 0.3s ease-out;
          `

          const createButton = (text: string, icon: string, onClick: () => void) => {
            const btn = document.createElement("button")
            btn.textContent = `${icon} ${text}`
            btn.style.cssText = `
              width: 100%;
              padding: 16px;
              border: none;
              background: white;
              text-align: center;
              font-size: 16px;
              cursor: pointer;
              border-radius: 8px;
              margin: 4px 0;
              font-weight: 500;
              color: #333;
            `
            btn.onclick = () => {
              document.body.removeChild(overlay)
              onClick()
            }
            btn.onmousedown = () => {
              btn.style.background = "#f3f4f6"
            }
            btn.onmouseup = () => {
              btn.style.background = "white"
            }
            return btn
          }

          sheet.appendChild(createButton("Share to...", "📤", () => resolve("share")))
          sheet.appendChild(createButton("Copy Link", "🔗", () => resolve("copy")))
          sheet.appendChild(createButton("Cancel", "❌", () => resolve("cancel")))

          overlay.appendChild(sheet)
          overlay.onclick = (e) => {
            if (e.target === overlay) {
              document.body.removeChild(overlay)
              resolve("cancel")
            }
          }

          document.body.appendChild(overlay)
        })

        if (userChoice === "share") {
          // User chose to open native share sheet
          await navigator.share({
            title: reel.title || "Pet Tale",
            text: `Check out ${petName}'s tale! 🐾`,
            url: normalizedUrl,
          })
        } else if (userChoice === "copy") {
          // User chose to copy link directly
          await navigator.clipboard.writeText(normalizedUrl)
          toast({
            title: "Link copied!",
            description: "Video link has been copied to your clipboard",
          })
        }
        // If cancel, do nothing
      } else {
        // No navigator.share - just copy to clipboard
        console.log(`📋 Copying to clipboard: ${normalizedUrl}`)
        await navigator.clipboard.writeText(normalizedUrl)
        toast({
          title: "Video link copied!",
          description: "Tale link copied to your clipboard",
        })
      }
    } catch (err) {
      console.error("Error sharing:", err)

      // Final fallback: try to copy Supabase URL first, then other URLs
      const fallbackUrl =
        reel.merged_video_supabase_url || reel.merged_video_url || reel.optimized_video_url || reel.video_url
      if (fallbackUrl) {
        try {
          const normalizedFallbackUrl = normalizeShareUrl(fallbackUrl)
          console.log(`📋 Final fallback - copying to clipboard: ${fallbackUrl} → ${normalizedFallbackUrl}`)
          await navigator.clipboard.writeText(normalizedFallbackUrl)
          toast({
            title: "Video link copied!",
            description: "The original video link has been copied to your clipboard",
          })
        } catch (clipboardError) {
          toast({
            title: "Error",
            description: "Failed to share the video",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Error",
          description: "No video available to share",
          variant: "destructive",
        })
      }
    }
  }

  const handleDownload = useCallback(
    async (entryId: string) => {
      if (isDownloading) return // Prevent double taps

      setIsDownloading(true)

      console.log("share_clicked", { type: "download", entryId })

      toast({
        title: "Preparing download…",
        description: "Getting your video ready to save",
      })

      try {
        const petName = reel?.pets?.name || "Unknown Pet"
        const title = reel?.title || "Pet Tale"
        const date = reel?.created_at
          ? new Date(reel.created_at).toISOString().split("T")[0].replace(/-/g, "")
          : new Date().toISOString().split("T")[0].replace(/-/g, "")

        // Create filename hint from available data
        const filenameHint = `${petName}-${title}-${date}`.replace(/[^a-zA-Z0-9-]/g, "-")

        const response = await fetch("/api/downloads/signed-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entryId,
            filename: filenameHint,
          }),
        })

        if (!response.ok) {
          let errorMessage = "Couldn't prepare the download. Try again."
          let variant: "default" | "destructive" = "destructive"
          let analyticsReason = "server_error"

          if (response.status === 404) {
            errorMessage = "Video not ready yet. Try again soon."
            variant = "default"
            analyticsReason = "not_ready"
          } else if (response.status === 400) {
            errorMessage = "Invalid request. Please refresh and try again."
            variant = "destructive"
            analyticsReason = "bad_request"
          }

          console.log("download_failed", { entryId, reason: analyticsReason })

          toast({
            title: errorMessage,
            description: "There was an issue preparing your video for download",
            variant,
          })
          return
        }

        const data = await response.json()

        if (data.url) {
          console.log("download_ready", { entryId, filename: data.filename })

          // Trigger download by navigating to signed URL
          window.location.href = data.url

          const userAgent = navigator.userAgent
          let platformTip = "Your video is downloading."

          if (userAgent.match(/(iPhone|iPad|iPod)/)) {
            platformTip = "Tap Share → Save Video to add to Photos."
          } else if (userAgent.match(/Android/)) {
            platformTip = "Saved to Downloads; it will appear in your Gallery."
          }

          toast({
            title: "Download started!",
            description: platformTip,
          })
        } else {
          throw new Error("No download URL received")
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("Download failed:", msg)
        console.log("download_failed", { entryId, reason: "server_error" })

        toast({
          title: "Couldn't prepare the download. Try again.",
          description: "There was an issue preparing your video for download",
          variant: "destructive",
        })
      } finally {
        // 2 second debounce to prevent double taps
        setTimeout(() => {
          setIsDownloading(false)
        }, 2000)
      }
    },
    [isDownloading, reel, toast],
  )

  const handleShareVideoFile = useCallback(
    async (entryId: string) => {
      // Early returns
      if (isSharingFile) return

      if (!supportsFileShare) {
        // Fallback to download for unsupported browsers
        handleDownload(entryId)
        return
      }

      setIsSharingFile(true)
      console.log("file_share_clicked", { entryId })

      toast({
        title: "Preparing video to share…",
        description: "Getting your video ready to share with apps",
      })

      try {
        const petName = reel?.pets?.name || "Unknown Pet"
        const title = reel?.title || "Pet Tale"
        const date = reel?.created_at
          ? new Date(reel.created_at).toISOString().split("T")[0].replace(/-/g, "")
          : new Date().toISOString().split("T")[0].replace(/-/g, "")

        // Create filename hint from available data (reuse logic from handleDownload)
        const filenameHint = `${petName}-${title}-${date}`.replace(/[^a-zA-Z0-9-]/g, "-")

        // Request signed URL
        const response = await fetch("/api/downloads/signed-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            entryId,
            filename: filenameHint,
          }),
        })

        if (!response.ok) {
          let errorMessage = "Couldn't prepare the video. Try Download instead."
          let analyticsReason = "server_error"

          if (response.status === 404) {
            errorMessage = "Video not ready yet. Try again soon."
            analyticsReason = "not_ready"
            toast({
              title: errorMessage,
              description: "The video is still being processed",
            })
          } else if (response.status === 400) {
            errorMessage = "Invalid request. Refresh and try again."
            analyticsReason = "bad_request"
            toast({
              title: errorMessage,
              description: "Please refresh the page and try again",
              variant: "destructive",
            })
          } else {
            toast({
              title: errorMessage,
              description: "There was an issue preparing your video",
              variant: "destructive",
            })
          }

          console.log("file_share_failed", { entryId, reason: analyticsReason })
          return
        }

        const data = await response.json()
        const signedUrl = data.url
        const filenameFromAPI = data.filename || `${filenameHint}.mp4`

        // Fetch the video blob
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), FILE_SHARE_FETCH_TIMEOUT_MS)

        try {
          const blobResponse = await fetch(signedUrl, {
            cache: "no-store",
            credentials: "omit",
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!blobResponse.ok) {
            throw new Error(`Failed to fetch video: ${blobResponse.status}`)
          }

          const blob = await blobResponse.blob()

          if (blob.size > FILE_SHARE_MAX_BYTES) {
            toast({
              title: "Video is too large to share directly. Downloading instead.",
              description: "Large videos work better with the download option",
            })
            handleDownload(entryId)
            return
          }

          const file = new File([blob], filenameFromAPI, { type: "video/mp4" })

          if (!navigator.canShare?.({ files: [file] })) {
            console.log("file_share_failed", { entryId, reason: "runtime_cannot_share" })
            toast({
              title: "This app can't share the video directly on your device.",
              description: "Downloading instead so you can share from Photos/Gallery.",
            })
            handleDownload(entryId)
            setIsSharingFile(false)
            return
          }

          await navigator.share({
            files: [file],
            title: reel?.title || "Pet Tale",
            text: `Check out ${petName}'s tale! 🐾 Made with pettaleai.com`,
          })

          console.log("file_share_success", { entryId, bytes: blob.size })
        } catch (fetchErr) {
          clearTimeout(timeoutId)

          const isAbortError = fetchErr instanceof Error && fetchErr.name === "AbortError"

          if (isAbortError) {
            toast({
              title: "Request timed out",
              description: "The video took too long to prepare. Try Download instead.",
              variant: "destructive",
            })
            console.log("file_share_failed", { entryId, reason: "timeout" })
          } else {
            toast({
              title: "Couldn't fetch the video. Try Download instead.",
              description: "There was an issue preparing your video for sharing",
              variant: "destructive",
            })
            console.log("file_share_failed", { entryId, reason: "fetch_error" })
          }
        }
      } catch (err) {
        const isAbortError = err instanceof Error && err.name === "AbortError"

        if (isAbortError) {
          console.log("file_share_failed", { entryId, reason: "user_cancel" })
        } else {
          toast({
            title: "Couldn't share the video. Try Download instead.",
            description: "There was an issue sharing your video",
            variant: "destructive",
          })
          console.log("file_share_failed", { entryId, reason: "share_error" })

          handleDownload(entryId)
        }
      } finally {
        setIsSharingFile(false)
      }
    },
    [isSharingFile, supportsFileShare, handleDownload, reel, toast],
  )

  const handleCopyLink = async () => {
    if (!reel) return

    try {
      const fallbackUrl =
        reel.merged_video_supabase_url || reel.merged_video_url || reel.optimized_video_url || reel.video_url

      if (fallbackUrl) {
        const transformedUrl = getPetTalesShareUrl(fallbackUrl)
        // The tale page (preview card + "make your own"), not the bare video file
        const normalizedUrl =
          reel.merged_video_supabase_url ? `${window.location.origin}/tale/${reel.id}` : normalizeShareUrl(transformedUrl)

        console.log(`📋 Copy Link - Transformed URL:`, {
          original: fallbackUrl,
          transformed: transformedUrl,
          normalized: normalizedUrl,
        })

        await navigator.clipboard.writeText(normalizedUrl)
        toast({
          title: "Link copied!",
          description: "Tale link copied. It opens a page that plays the video.",
        })
      } else {
        toast({
          title: "No video available",
          description: "This tale doesn't have a video to share yet",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error copying link:", err)
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (error || !reel) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tale Not Found</h1>
          <p className="text-gray-600 mb-4">{error || "The requested pet tale could not be found."}</p>
          <Button onClick={() => router.back()} className="bg-teal-600 hover:bg-teal-700 text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const posterBackfill = (
    <PosterBackfill taleId={reel.id} videoUrl={reel.merged_video_supabase_url || reel.merged_video_url} />
  )

  // Use mobile component for mobile devices
  if (isMobile) {
    return (
      <>
      {posterBackfill}
      <MobileReelDetail
        reel={reel}
        isLiked={isLiked}
        likeCount={likeCount}
        viewCount={viewCount}
        onLike={handleLike}
        onShare={handleShare}
        onDownload={() => handleDownload(reel.id)}
        onShareFile={() => handleShareVideoFile(reel.id)}
        supportsFileShare={supportsFileShare}
        isSharingFile={isSharingFile}
        isLiking={isLiking}
        hasRecordedView={hasRecordedView}
        onTogglePublic={handleTogglePublic}
        isTogglingPublic={isTogglingPublic}
        isDownloading={isDownloading}
      />
      </>
    )
  }

  const videoUrl = reel.merged_video_url || reel.optimized_video_url || reel.video_url
  const petName = reel.pets?.name || "Unknown Pet"
  const petType = reel.pets?.type || "pet"

  // Use the helper function to safely process pet image URLs
  const petAvatar = processImageUrl(reel.pets?.avatar_url)
  const petPhoto = processImageUrl(reel.pets?.photo_url)
  const petImage = processImageUrl(reel.pets?.image_url)

  const petImageUrl = petAvatar || petPhoto || petImage || `/placeholder.svg?height=96&width=96&query=${petType}`

  const hasDownloadableVideo = !!reel.merged_video_supabase_url

  const isShared = reel.is_public === true

  const voicePersonality = reel.narration_style ? getVoiceByValue(reel.narration_style) : null
  const voiceLabel = voicePersonality?.label || "Unknown Voice"

  const vibeGenre = reel.narration_genre ? NARRATION_GENRES.find((g) => g.value === reel.narration_genre) : null
  const vibeLabel = vibeGenre?.label || "Unknown Vibe"

  return (
    <div className="min-h-screen bg-gray-50">
      {posterBackfill}
      {/* Main Content - Three Column Grid */}
      <div className="grid grid-cols-[auto_1fr_420px] gap-6 max-w-[1400px] mx-auto px-10 py-10 items-start xl:grid-cols-[auto_1fr_420px] lg:grid-cols-[auto_1fr_360px] md:grid-cols-1 md:gap-8 sm:px-4">
        {/* LEFT COLUMN: Back Button */}
        <div className="pt-3 sticky top-10 z-10 md:static md:pt-0">
          <Button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-[1.5px] border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 hover:-translate-x-0.5 transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tales
          </Button>
        </div>

        {/* CENTER COLUMN: Video Container with Title */}
        <div className="flex flex-col items-center bg-gradient-to-br from-[#1a1f36] to-[#0f1419] rounded-xl shadow-xl p-10 md:p-8">
          <h1 className="text-[28px] font-bold text-white text-center mb-8 tracking-tight text-shadow-lg max-w-[600px] leading-tight">
            {reel.title || petName + "'s Tale"}
          </h1>

          <p className="text-white/70 text-center mb-8 text-sm">
            {voiceLabel} • {vibeLabel}
          </p>

          {/* Video Player */}
          <div className="w-full max-w-[420px] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl">
            {videoUrl && (
              <video src={videoUrl} controls className="w-full h-full object-contain" poster={petImageUrl}>
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div className="bg-white rounded-xl shadow-lg sticky top-10 max-h-[calc(100vh-80px)] overflow-y-auto md:static md:max-h-none">
          <div className="p-8 space-y-6">
            {/* VIDEO STATUS */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Video Status</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isShared ? "text-gray-400" : "text-gray-700"}`}>Private</span>
                  <Switch
                    checked={isShared}
                    onCheckedChange={() => handleTogglePublic(false)}
                    disabled={isTogglingPublic}
                    className="data-[state=checked]:bg-teal-600"
                  />
                  <span className={`text-sm font-medium ${isShared ? "text-teal-600" : "text-gray-400"}`}>Public</span>
                </div>
              </div>
              <div
                className={`rounded-lg p-4 border-2 transition-all duration-300 ${
                  isShared ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isShared ? (
                    <>
                      <Globe className="h-5 w-5 text-green-700" />
                      <Badge
                        variant="secondary"
                        className="bg-white text-green-800 border border-green-300 hover:bg-white text-base font-semibold"
                      >
                        🌐 Public
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 text-amber-700" />
                      <Badge
                        variant="secondary"
                        className="bg-white text-amber-800 border border-amber-300 hover:bg-white text-base font-semibold"
                      >
                        🔒 Private
                      </Badge>
                    </>
                  )}
                </div>
                <p className={`text-[15px] leading-relaxed ${isShared ? "text-green-900" : "text-amber-900"}`}>
                  {isShared
                    ? "This video is shared with the community! Everyone can view and enjoy it."
                    : "Only you can see this tale. Share the link with friends, or post to Community for everyone to discover."}
                </p>
              </div>
            </div>

            {/* ACTIONS */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Actions</h3>
              <div className="space-y-4">
                <div>
                  <Button
                    onClick={() => handleDownload(reel.id)}
                    disabled={isDownloading || !hasDownloadableVideo}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium h-11 justify-start text-[15px]"
                    title={!hasDownloadableVideo ? "Video not ready yet" : undefined}
                  >
                    {isDownloading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download Tale
                  </Button>
                  <p className="text-xs text-gray-500 mt-1.5 font-light">Post to TikTok, Instagram, or YouTube</p>
                </div>

                <div>
                  <Button
                    onClick={() => handleShareVideoFile(reel.id)}
                    disabled={isSharingFile || !supportsFileShare || !hasDownloadableVideo}
                    variant="outline"
                    className="w-full border-teal-600 text-teal-600 hover:bg-teal-50 font-medium h-11 justify-start text-[15px]"
                    title={!supportsFileShare ? "Your browser does not support file sharing" : undefined}
                  >
                    {isSharingFile ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600 mr-2" />
                    ) : (
                      <Share2 className="h-4 w-4 mr-2" />
                    )}
                    Share Link
                  </Button>
                  <p className="text-xs text-gray-500 mt-1.5 font-light">Send via text, email, or social media</p>
                </div>

                <div>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium h-11 justify-start bg-transparent text-[15px]"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <p className="text-xs text-gray-500 mt-1.5 font-light">Copy link to clipboard</p>
                </div>
              </div>
            </div>

            {/* COMMUNITY ENGAGEMENT */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Community Engagement</h3>
              {isShared ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                      <div className="text-3xl font-bold text-gray-900">{viewCount}</div>
                      <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">Views</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                      <div className="text-3xl font-bold text-gray-900">{likeCount}</div>
                      <div className="text-sm text-gray-600 uppercase tracking-wide mt-1">Likes</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[15px] text-blue-900 leading-relaxed">
                    Post to Community to track views and likes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Make Video Private?</h2>
            <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
              This video will be removed from the community feed. Your views and likes will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="border-teal-600 text-teal-600 hover:bg-teal-50 font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmMakePrivate}
                disabled={isTogglingPublic}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium"
              >
                {isTogglingPublic ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : null}
                Make Private
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
