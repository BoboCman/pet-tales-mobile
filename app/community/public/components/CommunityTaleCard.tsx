"use client"
import Link from "next/link"
import type React from "react"
import { formatDistanceToNow, isValid } from "date-fns"
import { Heart, PawPrint } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { togglePublicLikeClient } from "@/lib/api/engagement"
import { getSessionId, hasLikedTale, toggleTaleLike } from "@/lib/session/client-session"

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

interface CommunityTaleCardProps {
  tale: PublicTale
}

// Helper function to build image candidates in correct priority order
const buildImageCandidates = (pets: PublicTale["pets"]): string[] => {
  if (!pets) return []

  const candidates: string[] = []

  // Priority 1: pets.image_url (stored full URL)
  if (pets.image_url) {
    candidates.push(pets.image_url)
  }

  // Priority 2: pets.avatar_url
  if (pets.avatar_url) {
    candidates.push(pets.avatar_url)
  }

  // Priority 3: pets.photo_url
  if (pets.photo_url) {
    candidates.push(pets.photo_url)
  }

  // Priority 4: Try bucket guesses as fallback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && pets.id && pets.name) {
    const baseUrl = `${supabaseUrl}/storage/v1/object/public/pet-photo`
    const petSlug = pets.name.toLowerCase().replace(/\s+/g, "-")

    // Add bucket guesses
    const bucketCandidates = [
      `${baseUrl}/${pets.id}.jpg`,
      `${baseUrl}/${pets.id}.jpeg`,
      `${baseUrl}/${pets.id}.png`,
      `${baseUrl}/${pets.id}.webp`,
      `${baseUrl}/${petSlug}.jpg`,
      `${baseUrl}/${petSlug}.jpeg`,
      `${baseUrl}/${petSlug}.png`,
      `${baseUrl}/${petSlug}.webp`,
    ]

    candidates.push(...bucketCandidates)
  }

  return candidates
}

// Helper function to safely process image URLs
const processImageUrl = (url: string | null) => {
  if (!url) return null
  // If already a complete URL, use as-is
  if (url.startsWith("http")) return url
  // Otherwise, it's a storage path - process it
  return url
}

// Mood system
const baseMoodCategories: Record<string, { emoji: string; color: string; darkColor: string; keywords: string[] }> = {
  happy: {
    emoji: "😊",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    darkColor: "dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    keywords: ["happy", "joy", "cheerful", "content", "pleased", "delighted", "glad", "thrilled"],
  },
  excited: {
    emoji: "🤩",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    darkColor: "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    keywords: ["excited", "enthusiastic", "eager", "thrilled", "energetic", "animated", "lively"],
  },
  playful: {
    emoji: "🎾",
    color: "bg-green-100 text-green-700 border-green-200",
    darkColor: "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    keywords: ["playful", "fun", "frisky", "mischievous", "spirited", "active", "bouncy", "zoomies"],
  },
  sad: {
    emoji: "😢",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    darkColor: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    keywords: ["sad", "unhappy", "down", "blue", "gloomy", "depressed", "melancholy", "upset"],
  },
  relaxed: {
    emoji: "😌",
    color: "bg-teal-100 text-teal-700 border-teal-200",
    darkColor: "dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
    keywords: ["relaxed", "calm", "peaceful", "tranquil", "serene", "mellow", "chill", "resting"],
  },
  sleepy: {
    emoji: "😴",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    darkColor: "dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
    keywords: ["sleepy", "tired", "drowsy", "dozing", "napping", "yawning", "exhausted", "snoozing"],
  },
  curious: {
    emoji: "🧐",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    darkColor: "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    keywords: ["curious", "inquisitive", "interested", "exploring", "investigating", "nosy", "attentive"],
  },
  hungry: {
    emoji: "🍗",
    color: "bg-red-100 text-red-700 border-red-200",
    darkColor: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    keywords: ["hungry", "starving", "famished", "ravenous", "appetite", "food", "treat", "snack"],
  },
  scared: {
    emoji: "😨",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    darkColor: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    keywords: ["scared", "afraid", "frightened", "fearful", "anxious", "nervous", "timid", "startled"],
  },
  angry: {
    emoji: "😠",
    color: "bg-red-100 text-red-700 border-red-200",
    darkColor: "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    keywords: ["angry", "mad", "upset", "annoyed", "irritated", "grumpy", "frustrated", "furious"],
  },
  loving: {
    emoji: "❤️",
    color: "bg-pink-100 text-pink-700 border-pink-200",
    darkColor: "dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
    keywords: ["loving", "affectionate", "cuddly", "adoring", "devoted", "fond", "attached", "bonded"],
  },
  mischievous: {
    emoji: "😈",
    color: "bg-violet-100 text-violet-700 border-violet-200",
    darkColor: "dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
    keywords: ["mischievous", "naughty", "troublemaker", "sneaky", "sly", "crafty", "impish", "prankster"],
  },
  default: {
    emoji: "🐾",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    darkColor: "dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    keywords: ["unknown", "neutral", "normal", "default"],
  },
}

// Special case mood mappings
const specialMoodMappings: Record<string, { emoji: string; color: string; darkColor: string }> = {
  "regal relaxation": {
    emoji: "👑",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    darkColor: "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  zoomies: {
    emoji: "💨",
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    darkColor: "dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
  },
  "treat time": {
    emoji: "🦴",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    darkColor: "dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  "belly rubs": {
    emoji: "✋",
    color: "bg-pink-100 text-pink-700 border-pink-200",
    darkColor: "dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
  },
  "squirrel alert": {
    emoji: "🐿️",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    darkColor: "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
  "nap time": {
    emoji: "💤",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    darkColor: "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
}

function getMoodInfo(mood: string | null | undefined): {
  emoji: string
  color: string
  darkColor: string
  displayText: string
} {
  if (!mood) {
    return {
      ...baseMoodCategories.default,
      displayText: "Unknown Mood",
    }
  }

  const normalizedMood = mood.toLowerCase().trim()

  // Check for exact special case matches first
  for (const [specialMood, info] of Object.entries(specialMoodMappings)) {
    if (normalizedMood === specialMood.toLowerCase()) {
      return {
        ...info,
        displayText: mood,
      }
    }
  }

  // Check for keyword matches in base categories
  for (const [category, info] of Object.entries(baseMoodCategories)) {
    if (info.keywords.some((keyword) => normalizedMood.includes(keyword))) {
      return {
        emoji: info.emoji,
        color: info.color,
        darkColor: info.darkColor,
        displayText: mood,
      }
    }
  }

  // If no match found, try to extract a single word if it's a phrase
  const words = normalizedMood.split(/\s+/)
  if (words.length > 1) {
    for (const word of words) {
      for (const [category, info] of Object.entries(baseMoodCategories)) {
        if (info.keywords.some((keyword) => word === keyword)) {
          return {
            emoji: info.emoji,
            color: info.color,
            darkColor: info.darkColor,
            displayText: mood,
          }
        }
      }
    }
  }

  // Generate emoji based on first character for truly unique moods
  const uniqueEmojis: Record<string, string> = {
    a: "🦊",
    b: "🐻",
    c: "🐱",
    d: "🐶",
    e: "🦅",
    f: "🦊",
    g: "🦒",
    h: "🐹",
    i: "🦔",
    j: "🦘",
    k: "🐨",
    l: "🦁",
    m: "🐭",
    n: "🐄",
    o: "🦉",
    p: "🐧",
    q: "🐇",
    r: "🐀",
    s: "🐍",
    t: "🐅",
    u: "🦄",
    v: "🦊",
    w: "🐺",
    x: "🦊",
    y: "🐕",
    z: "🦓",
  }

  const firstChar = normalizedMood.charAt(0)
  const emoji = uniqueEmojis[firstChar] || "🐾"

  // Return with a dynamic color based on the first character
  const colors = [
    "bg-red-100 text-red-700 border-red-200",
    "bg-orange-100 text-orange-700 border-orange-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-yellow-100 text-yellow-700 border-yellow-200",
    "bg-lime-100 text-lime-700 border-lime-200",
    "bg-green-100 text-green-700 border-green-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-rose-100 text-rose-700 border-rose-200",
  ]

  const darkColors = [
    "dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
    "dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    "dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    "dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800",
    "dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    "dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    "dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
    "dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
    "dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
    "dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    "dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
    "dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
    "dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    "dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800",
    "dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
    "dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  ]

  const colorIndex = (firstChar.charCodeAt(0) || 0) % colors.length
  const color = colors[colorIndex]
  const darkColor = darkColors[colorIndex]

  return {
    emoji,
    color,
    darkColor,
    displayText: mood,
  }
}

export function CommunityTaleCard({ tale }: CommunityTaleCardProps) {
  const [likeCount, setLikeCount] = useState(tale.like_count || 0)
  const [isLiked, setIsLiked] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [imageCandidates, setImageCandidates] = useState<string[]>([])
  const [candidateIndex, setCandidateIndex] = useState(0)

  // Initialize like state from session storage
  useEffect(() => {
    setIsLiked(hasLikedTale(tale.id))
  }, [tale.id])

  useEffect(() => {
    const candidates = buildImageCandidates(tale.pets)
    setImageCandidates(candidates)
    setCandidateIndex(0) // Reset to first candidate
  }, [tale.pets])

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isLiking) return

    setIsLiking(true)

    // Optimistic update
    const newIsLiked = !isLiked
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1)

    setIsLiked(newIsLiked)
    setLikeCount(newLikeCount)

    // Update session storage
    toggleTaleLike(tale.id)

    try {
      const sessionId = getSessionId()
      const result = await togglePublicLikeClient(tale.id, sessionId)

      if (result.success && result.likeCount !== undefined) {
        // Update with actual database count
        setLikeCount(result.likeCount)
      } else {
        // Revert optimistic update on failure
        setIsLiked(!newIsLiked)
        setLikeCount(likeCount)
        toggleTaleLike(tale.id) // Revert session storage
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      // Revert optimistic update
      setIsLiked(!newIsLiked)
      setLikeCount(likeCount)
      toggleTaleLike(tale.id) // Revert session storage
    } finally {
      setIsLiking(false)
    }
  }

  // Format the date with error handling
  let formattedDate = "Unknown date"
  try {
    const date = new Date(tale.created_at)
    if (isValid(date)) {
      formattedDate = formatDistanceToNow(date, { addSuffix: true })
    }
  } catch (error) {
    console.error("Error formatting date:", error, tale.created_at)
  }

  const title = tale.title || "Untitled Story"
  const petName = tale.pets?.name || "Unknown Pet"
  const petType = tale.pets?.type || "pet"

  const handleImageError = () => {
    if (candidateIndex < imageCandidates.length - 1) {
      setCandidateIndex(candidateIndex + 1)
    }
    // If we've exhausted all candidates, the placeholder will be used automatically
  }

  const currentImageSrc = imageCandidates[candidateIndex] || `/placeholder.svg?height=96&width=96&query=${petType}`

  const moodInfo = getMoodInfo(tale.mood)

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md dark:border-gray-700">
      {/* Header section */}
      <div className="flex items-center p-4 border-b border-muted/50 dark:border-gray-700 relative">
        {/* Pet avatar in circular frame */}
        <Avatar className="h-14 w-14 border-2 border-white dark:border-gray-800 shadow-sm mr-3">
          <AvatarImage src={currentImageSrc || undefined} alt={petName} onError={handleImageError} />
          <AvatarFallback className="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <PawPrint className="h-7 w-7" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {/* Pet name */}
          <h3 className="font-medium text-base truncate text-foreground">{petName}</h3>
          {/* Dynamic Mood badge */}
          <div
            className={`mt-1 px-2 py-0.5 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${moodInfo.color} ${moodInfo.darkColor}`}
          >
            <span>{moodInfo.emoji}</span>
            <span className="capitalize truncate">{moodInfo.displayText}</span>
          </div>
        </div>

        {/* Like button in top right */}
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`p-2 rounded-full transition-colors ${
            isLiked ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-red-500"
          } ${isLiking ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Content section */}
      <CardContent className="p-4 space-y-3">
        {/* Title - centered */}
        <h3 className="font-medium text-base line-clamp-1 text-foreground text-center">{title}</h3>

        {/* Watch Tale button */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full justify-center text-teal-600 border-teal-200 hover:bg-teal-50 hover:text-teal-700 h-9 px-3 text-sm dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 bg-transparent"
        >
          <Link href={`/community/public/${tale.id}`} className="flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Watch Tale
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
