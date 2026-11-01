"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Heart, ArrowRight, Sparkles } from "lucide-react"
import { CommunityTaleCard } from "./components/CommunityTaleCard"
import { JoinCommunityBanner } from "./components/JoinCommunityBanner"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface PublicTale {
  id: string
  title: string | null
  content: string | null
  mood: string | null
  image_url: string | null
  video_url: string | null
  optimized_video_url: string | null
  merged_video_url: string | null
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

export default function CommunityPublicPageClient() {
  const [tales, setTales] = useState<PublicTale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)

  const stats = {
    totalTales: tales.length,
    totalViews: tales.reduce((sum, tale) => sum + (tale.view_count || 0), 0),
    totalLikes: tales.reduce((sum, tale) => sum + (tale.like_count || 0), 0),
    activePets: tales.filter((tale) => tale.pets).length,
  }

  const fetchData = async () => {
    try {
      console.log("Client: Starting fetch...")
      setError(null)

      const response = await fetch("/api/public-tales")
      console.log("Client: Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Client: Response not ok:", errorText)
        throw new Error(`Failed to fetch community data: ${response.status}`)
      }

      const data = await response.json()
      console.log("Client: Raw response data:", data)

      let processedTales: PublicTale[] = []

      if (Array.isArray(data)) {
        processedTales = data
        console.log("Client: Using direct array, length:", processedTales.length)
      } else if (data && typeof data === "object" && data.tales && Array.isArray(data.tales)) {
        processedTales = data.tales
        console.log("Client: Using nested tales array, length:", processedTales.length)
      } else if (data && typeof data === "object" && !data.error) {
        processedTales = [data]
        console.log("Client: Wrapped single object")
      } else {
        console.log("Client: No valid data found, using empty array")
        processedTales = []
      }

      console.log("Client: Final processed tales:", processedTales.length)
      setTales(processedTales)
    } catch (err) {
      console.error("Client: Error fetching community data:", err)
      setError(err instanceof Error ? err.message : "Failed to load community data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsSignedIn(!!session)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && tales.length > 0) {
        console.log("Page became visible, refreshing engagement data...")
        fetchData()
      }
    }

    const handleFocus = () => {
      if (tales.length > 0) {
        console.log("Window gained focus, refreshing engagement data...")
        fetchData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [tales.length])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-24">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">
                <Heart className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Oops! Something went wrong</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-24">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/20 to-blue-600/20 dark:from-teal-400/10 dark:to-blue-400/10" />
        <div className="relative container mx-auto px-4 py-12 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Pet Tales
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-400">
                {" "}
                Gallery
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              See what families are sharing — real pets, real moments, real stories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isSignedIn ? (
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white" asChild>
                  <Link href="/dashboard/reels/new">
                    <Sparkles className="h-5 w-5 mr-2" />
                    Create Your Own
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white" asChild>
                    <Link href="/auth/signup">
                      <Heart className="h-5 w-5 mr-2" />
                      Try It Free
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/auth/login">
                      Sign In
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tales Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Tales</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden h-full">
                  <div className="flex items-center p-4 border-b border-muted/50">
                    <Skeleton className="h-14 w-14 rounded-full mr-3" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-16 rounded-full" />
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <Skeleton className="h-4 w-full mb-2" />
                      <div className="flex items-center gap-2 mt-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-1" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-1" />
                        <Skeleton className="h-3 w-8" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tales.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {tales.map((tale) => (
                  <CommunityTaleCard key={tale.id} tale={tale} />
                ))}
              </div>

              {!isSignedIn && tales.length > 0 && (
                <div className="mb-8">
                  <JoinCommunityBanner />
                </div>
              )}
            </>
          ) : (
            <Card className="p-12 text-center">
              <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tales yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to share your pet's story with the community!</p>
              <Button asChild>
                <Link href={isSignedIn ? "/dashboard/reels/new" : "/auth/signup"}>
                  {isSignedIn ? "Create Your First Tale" : "Sign Up to Create a Tale"}
                </Link>
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
