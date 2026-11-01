"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Video,
  Eye,
  Heart,
  Globe,
  Lock,
  Grid3x3,
  List,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface VideoItem {
  id: string
  title: string
  createdAt: string
  viewCount: number
  likeCount: number
  isPublic: boolean
  videoUrl: string | null
  thumbnailUrl: string | null
  narrationStyle: string
  narrationGenre: string
  status: string
  userId: string
  pet: {
    id: string
    name: string
    type: string
    avatarUrl: string | null
  }
  creator: {
    email: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [visibility, setVisibility] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [voiceFilter, setVoiceFilter] = useState("all")
  const [vibeFilter, setVibeFilter] = useState("all")
  const [petTypeFilter, setPetTypeFilter] = useState("all")
  const [petGenderFilter, setPetGenderFilter] = useState("all")
  const [petAgeFilter, setPetAgeFilter] = useState("all")
  const [breedFilter, setBreedFilter] = useState("")

  const { toast } = useToast()

  const fetchVideos = async (
    page = 1,
    search = "",
    vis = "all",
    voice = "all",
    vibe = "all",
    petType = "all",
    petGender = "all",
    petAge = "all",
    breed = "",
  ) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        visibility: vis,
        sortBy: "created_at",
        sortOrder: "desc",
        voice,
        vibe,
        petType,
        petGender,
        petAge,
        breed,
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`/api/admin/videos?${params}`, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch videos")
      }

      const result = await response.json()
      if (result.success) {
        setVideos(result.data.videos)
        setPagination(result.data.pagination)
      } else {
        throw new Error(result.error || "Failed to fetch videos")
      }
    } catch (error) {
      console.error("Error fetching videos:", error)
      toast({
        title: "Error",
        description: "Failed to load videos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleSearch = () => {
    setSearchQuery(searchInput)
    fetchVideos(
      1,
      searchInput,
      visibility,
      voiceFilter,
      vibeFilter,
      petTypeFilter,
      petGenderFilter,
      petAgeFilter,
      breedFilter,
    )
  }

  const handleVisibilityChange = (value: string) => {
    setVisibility(value)
    fetchVideos(
      1,
      searchQuery,
      value,
      voiceFilter,
      vibeFilter,
      petTypeFilter,
      petGenderFilter,
      petAgeFilter,
      breedFilter,
    )
  }

  const handleVoiceChange = (value: string) => {
    setVoiceFilter(value)
    fetchVideos(
      1,
      searchQuery,
      visibility,
      value,
      vibeFilter,
      petTypeFilter,
      petGenderFilter,
      petAgeFilter,
      breedFilter,
    )
  }

  const handleVibeChange = (value: string) => {
    setVibeFilter(value)
    fetchVideos(
      1,
      searchQuery,
      visibility,
      voiceFilter,
      value,
      petTypeFilter,
      petGenderFilter,
      petAgeFilter,
      breedFilter,
    )
  }

  const handlePetTypeChange = (value: string) => {
    setPetTypeFilter(value)
    fetchVideos(1, searchQuery, visibility, voiceFilter, vibeFilter, value, petGenderFilter, petAgeFilter, breedFilter)
  }

  const handlePetGenderChange = (value: string) => {
    setPetGenderFilter(value)
    fetchVideos(1, searchQuery, visibility, voiceFilter, vibeFilter, petTypeFilter, value, petAgeFilter, breedFilter)
  }

  const handlePetAgeChange = (value: string) => {
    setPetAgeFilter(value)
    fetchVideos(1, searchQuery, visibility, voiceFilter, vibeFilter, petTypeFilter, petGenderFilter, value, breedFilter)
  }

  const clearAllFilters = () => {
    setSearchInput("")
    setSearchQuery("")
    setVisibility("all")
    setVoiceFilter("all")
    setVibeFilter("all")
    setPetTypeFilter("all")
    setPetGenderFilter("all")
    setPetAgeFilter("all")
    setBreedFilter("")
    fetchVideos(1, "", "all", "all", "all", "all", "all", "all", "")
  }

  const handlePageChange = (newPage: number) => {
    fetchVideos(
      newPage,
      searchQuery,
      visibility,
      voiceFilter,
      vibeFilter,
      petTypeFilter,
      petGenderFilter,
      petAgeFilter,
      breedFilter,
    )
  }

  const hasActiveFilters =
    searchQuery ||
    visibility !== "all" ||
    voiceFilter !== "all" ||
    vibeFilter !== "all" ||
    petTypeFilter !== "all" ||
    petGenderFilter !== "all" ||
    petAgeFilter !== "all" ||
    breedFilter

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Video Management</h1>
            <p className="text-gray-600 mt-1">Browse and manage all videos</p>
          </div>
        </div>
        <Link href="/admin/users">
          <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
            <Users className="h-4 w-4" />
            View Users
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Search by title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select value={visibility} onValueChange={handleVisibilityChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Videos</SelectItem>
                <SelectItem value="public">Public Only</SelectItem>
                <SelectItem value="private">Private Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Voice Filter */}
            <Select value={voiceFilter} onValueChange={handleVoiceChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Voices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Voices</SelectItem>
                <SelectItem value="baby_innocent">👶 Baby Talk</SelectItem>
                <SelectItem value="british_narrator">🎩 British Narrator</SelectItem>
                <SelectItem value="sassy_adult">😏 Sassy & Sarcastic</SelectItem>
                <SelectItem value="tough_guy">🛡️ Tough Guy</SelectItem>
                <SelectItem value="southern_belle">🎀 Southern Belle</SelectItem>
                <SelectItem value="gentle_giant">🐻 Gentle Giant</SelectItem>
                <SelectItem value="irish_lass">🍀 Irish Lass</SelectItem>
                <SelectItem value="chill_swag">🏝️ Island Storyteller</SelectItem>
                <SelectItem value="sweet_pea">🌸 Sweet Pea</SelectItem>
                <SelectItem value="grandpa_storyteller">👴 Grandpa Storyteller</SelectItem>
                <SelectItem value="hyper_enthusiast">⚡ Super Excited</SelectItem>
                <SelectItem value="grandma_storyteller">👵 Grandma Storyteller</SelectItem>
              </SelectContent>
            </Select>

            {/* Vibe Filter */}
            <Select value={vibeFilter} onValueChange={handleVibeChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Vibes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vibes</SelectItem>
                <SelectItem value="comedy">Comedy</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="swag">Swag</SelectItem>
                <SelectItem value="documentary">Documentary</SelectItem>
                <SelectItem value="chaotic">Chaotic</SelectItem>
                <SelectItem value="heartfelt">Heartfelt</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mt-3">
            {/* Pet Type Filter */}
            <Select value={petTypeFilter} onValueChange={handlePetTypeChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Pets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pets</SelectItem>
                <SelectItem value="dog">🐕 Dogs</SelectItem>
                <SelectItem value="cat">🐈 Cats</SelectItem>
              </SelectContent>
            </Select>

            {/* Pet Gender Filter */}
            <Select value={petGenderFilter} onValueChange={handlePetGenderChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">♂️ Male</SelectItem>
                <SelectItem value="female">♀️ Female</SelectItem>
              </SelectContent>
            </Select>

            {/* Pet Age Filter */}
            <Select value={petAgeFilter} onValueChange={handlePetAgeChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Ages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="Puppy/Kitten: 0–1 year">Puppy/Kitten: 0–1 year</SelectItem>
                <SelectItem value="Young Adult: 1–3 years">Young Adult: 1–3 years</SelectItem>
                <SelectItem value="Adult: 3–7 years">Adult: 3–7 years</SelectItem>
                <SelectItem value="Mature Adult: 8–10 years">Mature Adult: 8–10 years</SelectItem>
                <SelectItem value="Senior: 10+ years">Senior: 10+ years</SelectItem>
              </SelectContent>
            </Select>

            {/* Pet Breed Filter */}
            <Input
              placeholder="Filter by breed..."
              value={breedFilter}
              onChange={(e) => setBreedFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-[180px]"
            />

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearAllFilters} className="text-gray-500">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            <div className="flex gap-1 border rounded-md p-1 ml-auto">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Videos */}
      <Card>
        <CardHeader>
          <CardTitle>Videos {pagination && `(${pagination.total} total)`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No videos found</div>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {videos.map((video) => (
                    <Link key={video.id} href={`/admin/videos/${video.id}`} className="group">
                      <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-gray-200 flex items-center justify-center">
                          {video.thumbnailUrl || video.pet.avatarUrl ? (
                            <img
                              src={video.thumbnailUrl || video.pet.avatarUrl || ""}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Video className="h-12 w-12 text-gray-400" />
                          )}
                          {/* Visibility badge */}
                          <div className="absolute top-2 right-2">
                            {video.isPublic ? (
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
                        </div>

                        {/* Info */}
                        <div className="p-3 space-y-2">
                          <h3 className="font-medium truncate group-hover:text-blue-600">{video.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="truncate">{video.pet.name}</span>
                            <span>•</span>
                            <span>{video.pet.type}</span>
                          </div>

                          <div className="flex gap-1 mt-1 flex-wrap">
                            {video.narrationStyle && video.narrationStyle !== "unknown" && (
                              <Badge variant="outline" className="text-xs">
                                🎙️ {video.narrationStyle.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {video.narrationGenre && video.narrationGenre !== "unknown" && (
                              <Badge variant="secondary" className="text-xs">
                                ✨ {video.narrationGenre}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {video.viewCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {video.likeCount}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">{new Date(video.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map((video) => (
                    <Link key={video.id} href={`/admin/videos/${video.id}`} className="block">
                      <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                        {/* Thumbnail */}
                        <div className="h-20 w-32 flex-shrink-0 bg-gray-200 rounded flex items-center justify-center overflow-hidden">
                          {video.thumbnailUrl || video.pet.avatarUrl ? (
                            <img
                              src={video.thumbnailUrl || video.pet.avatarUrl || ""}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Video className="h-8 w-8 text-gray-400" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{video.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span>{video.pet.name}</span>
                            <span>•</span>
                            <span>{video.creator.email}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {video.viewCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {video.likeCount}
                            </span>
                            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="flex gap-1 mt-2 flex-wrap">
                            {video.narrationStyle && video.narrationStyle !== "unknown" && (
                              <Badge variant="outline" className="text-xs">
                                🎙️ {video.narrationStyle.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {video.narrationGenre && video.narrationGenre !== "unknown" && (
                              <Badge variant="secondary" className="text-xs">
                                ✨ {video.narrationGenre}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Visibility */}
                        <div className="flex-shrink-0">
                          {video.isPublic ? (
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
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
