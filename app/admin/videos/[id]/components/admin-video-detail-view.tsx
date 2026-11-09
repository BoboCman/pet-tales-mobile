"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TaleHealthBadge } from "@/components/admin/tale-health-badge"
import type { TaleHealth } from "@/lib/tale-health"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { RefreshCw, Video, Eye, Heart, User, Globe, Lock, Trash2, AlertCircle, RotateCcw, Loader2 } from "lucide-react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface VideoDetailData {
  video: {
    id: string
    title: string
    content: string | null
    createdAt: string
    viewCount: number
    likeCount: number
    isPublic: boolean
    videoUrl: string | null
    thumbnailUrl: string | null
    narrationStyle: string
    narrationGenre: string
    status: string
    mergeError: string | null
    compressionStatus: string | null
    health?: TaleHealth
    mergeDetails?: unknown
  }
  pet: {
    id: string
    name: string
    type: string
    breed: string | null
    avatarUrl: string | null
  }
  creator: {
    id: string
    email: string
  }
}

interface AdminVideoDetailViewProps {
  videoId: string
}

export default function AdminVideoDetailView({ videoId }: AdminVideoDetailViewProps) {
  const [data, setData] = useState<VideoDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const fetchVideoDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Video not found")
        }
        throw new Error("Failed to fetch video details")
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || "Failed to fetch video details")
      }
    } catch (error) {
      console.error("Error fetching video details:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load video details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideoDetail()
  }, [videoId])

  const toggleVisibility = async () => {
    if (!data) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isPublic: !data.video.isPublic }),
      })

      if (!response.ok) {
        throw new Error("Failed to update video visibility")
      }

      const result = await response.json()
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        // Refresh data
        fetchVideoDetail()
      } else {
        throw new Error(result.error || "Failed to update video")
      }
    } catch (error) {
      console.error("Error updating video:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update video",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const [retrying, setRetrying] = useState(false)
  const retryMerge = async (rebuild = false) => {
    try {
      setRetrying(true)
      const response = await fetch(`/api/admin/videos/${videoId}/retry-merge`, {
        method: "POST",
        // Admin POST routes reject requests without a JSON content type
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rebuild }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Retry failed")
      if (result.rebuilding) {
        toast({
          title: "Redoing the tale",
          description: "It starts again from the original video and takes about 3 to 5 minutes. Refresh to check.",
        })
      } else {
        toast({ title: "Tale finished", description: "The video is ready and the owner has been emailed." })
      }
      fetchVideoDetail()
    } catch (error) {
      toast({
        title: "Couldn't finish the tale",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setRetrying(false)
    }
  }

  const deleteVideo = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to delete video")
      }

      const result = await response.json()
      if (result.success) {
        toast({
          title: "Success",
          description: "Video deleted successfully",
        })
        // Redirect to videos list
        router.push("/admin/videos")
      } else {
        throw new Error(result.error || "Failed to delete video")
      }
    } catch (error) {
      console.error("Error deleting video:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete video",
        variant: "destructive",
      })
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading video details...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Video not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVideoDetail} disabled={actionLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant={data.video.isPublic ? "outline" : "default"}
            size="sm"
            onClick={toggleVisibility}
            disabled={actionLoading}
          >
            {data.video.isPublic ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Make Private
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Make Public
              </>
            )}
          </Button>
        </div>

        <div className="flex gap-2">
        {data.video.status === "completed" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={retrying || actionLoading}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Redo tale
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Redo this tale?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use this when the finished video came out wrong, for example cut short. It is rebuilt from the
                  original upload with the same story and narration, and replaces the current video in about 3 to 5
                  minutes. The owner isn&apos;t charged.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => retryMerge(true)}>Redo tale</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={actionLoading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Video
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the video &quot;{data.video.title}&quot; and
                remove all associated data including views and likes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteVideo} className="bg-red-600 hover:bg-red-700">
                Delete Video
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      {data.video.status !== "completed" && data.video.status !== "processing" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                This tale didn&apos;t finish
              </div>
              {data.video.mergeError && (
                <p className="text-xs text-gray-600 break-words max-w-2xl">{data.video.mergeError}</p>
              )}
              <p className="text-xs text-gray-500">
                Retrying re-runs the last step (narration and captions). The owner isn&apos;t charged again.
              </p>
            </div>
            <Button onClick={() => retryMerge()} disabled={retrying || actionLoading} className="shrink-0">
              {retrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {retrying ? "Finishing… (up to 3 min)" : "Retry tale"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Video Player */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{data.video.title}</CardTitle>
            {data.video.isPublic ? (
              <Badge className="bg-green-500">
                <Globe className="h-3 w-3 mr-1" />
                Public
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data.video.videoUrl ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video controls className="w-full h-full" poster={data.video.thumbnailUrl || undefined}>
                <source src={data.video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Video className="h-12 w-12 mx-auto mb-2" />
                <p>Video not available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Info & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Video Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Video ID</div>
              <div className="font-mono text-xs break-all">{data.video.id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Created</div>
              <div className="font-medium">{new Date(data.video.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <Badge variant="secondary">{data.video.status}</Badge>
            </div>
            {data.video.health && (
              <div className="md:col-span-2">
                <div className="text-sm text-gray-500">Length check</div>
                <div className="flex flex-wrap items-center gap-2">
                  <TaleHealthBadge health={data.video.health} />
                  <span className="text-sm">{data.video.health.label}</span>
                </div>
                {data.video.mergeDetails != null && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-500">Merge log (merge_details)</summary>
                    <pre className="mt-1 max-h-72 overflow-auto rounded bg-gray-50 p-2 text-xs">
                      {JSON.stringify(
                        typeof data.video.mergeDetails === "string"
                          ? (() => {
                              try {
                                return JSON.parse(data.video.mergeDetails as string)
                              } catch {
                                return data.video.mergeDetails
                              }
                            })()
                          : data.video.mergeDetails,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Narration Style</div>
              <div className="font-medium">{data.video.narrationStyle}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Genre</div>
              <div className="font-medium">{data.video.narrationGenre}</div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Total Views</div>
              <div className="text-3xl font-bold">{data.video.viewCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Likes</div>
              <div className="text-3xl font-bold flex items-center gap-2">
                <Heart className="h-6 w-6 text-red-500" />
                {data.video.likeCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Engagement Rate</div>
              <div className="font-medium">
                {data.video.viewCount > 0
                  ? `${Math.round((data.video.likeCount / data.video.viewCount) * 100)}%`
                  : "N/A"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pet & Creator Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Pet & Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pet */}
            <div>
              <div className="text-sm text-gray-500 mb-2">Pet</div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {data.pet.avatarUrl ? (
                    <img
                      src={data.pet.avatarUrl || "/placeholder.svg"}
                      alt={data.pet.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">🐾</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{data.pet.name}</div>
                  <div className="text-sm text-gray-500">
                    {data.pet.type}
                    {data.pet.breed && ` • ${data.pet.breed}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Creator */}
            <div>
              <div className="text-sm text-gray-500 mb-2">Creator</div>
              <div className="font-medium">{data.creator.email}</div>
              <Link href={`/admin/users/${data.creator.id}`}>
                <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                  View User Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video Content/Description */}
      {data.video.content && (
        <Card>
          <CardHeader>
            <CardTitle>Story Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{data.video.content}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video URL */}
      <Card>
        <CardHeader>
          <CardTitle>Video URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.video.videoUrl && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Video URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 p-2 rounded text-xs break-all">{data.video.videoUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(data.video.videoUrl || "")
                    toast({ title: "Copied to clipboard" })
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
          {data.video.thumbnailUrl && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Thumbnail URL</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 p-2 rounded text-xs break-all">{data.video.thumbnailUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(data.video.thumbnailUrl || "")
                    toast({ title: "Copied to clipboard" })
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Link */}
      {data.video.isPublic && (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Public Video Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white p-2 rounded text-sm break-all">
                {`${window.location.origin}/dashboard/reels/${data.video.id}`}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/dashboard/reels/${data.video.id}`
                  navigator.clipboard.writeText(url)
                  toast({ title: "Public link copied to clipboard" })
                }}
              >
                Copy Link
              </Button>
              <Link href={`/dashboard/reels/${data.video.id}`} target="_blank">
                <Button variant="default" size="sm">
                  Open
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
