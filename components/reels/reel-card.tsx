"use client"

import { useState } from "react"
import Link from "next/link"
import { formatDistanceToNow, isValid } from "date-fns"
import { Heart, Trash2, PawPrint } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteReel } from "@/app/actions/reel-actions"
import type { Database } from "@/lib/supabase/database.types"
import { getPublicUrl } from "@/lib/supabase/url-utils"

type DiaryEntry = Database["public"]["Tables"]["diary_entries"]["Row"] & {
  pets?: Database["public"]["Tables"]["pets"]["Row"] | null
  views?: number
}

interface ReelCardProps {
  reel: DiaryEntry
  className?: string
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (!isValid(date)) {
      return "Invalid date"
    }
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Invalid date"
  }
}

// Helper function to safely process image URLs
const processImageUrl = (url: string | null) => {
  if (!url) return null

  // If already a complete URL, use as-is
  if (url.startsWith("http")) return url

  // Otherwise, it's a storage path - process it
  return getPublicUrl(url)
}

// Base mood categories with emojis and colors
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

// Special case mood mappings for specific phrases
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

// Function to find the best matching mood category for any given mood string
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
        displayText: mood, // Use original casing
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
        displayText: mood, // Use original casing
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
            displayText: mood, // Use original casing
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

  // Use the character code to select a color
  const colorIndex = (firstChar.charCodeAt(0) || 0) % colors.length
  const color = colors[colorIndex]
  const darkColor = darkColors[colorIndex]

  return {
    emoji,
    color,
    darkColor,
    displayText: mood, // Use original casing
  }
}

export function ReelCard({ reel, className }: ReelCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Use engagement metrics directly from entry data with safe defaults
  const metrics = {
    viewCount: reel.view_count ?? 0,
    likeCount: reel.like_count ?? 0,
  }

  // Format the date with error handling
  let formattedDate = "Unknown date"
  try {
    const date = new Date(reel.created_at)
    if (isValid(date)) {
      formattedDate = formatDistanceToNow(date, { addSuffix: true })
    }
  } catch (error) {
    console.error("Error formatting date:", error, reel.created_at)
  }

  const title = reel.title || "Untitled Story"
  const id = reel.id

  // Get pet information with safe defaults
  const petName = reel.pets?.name || "Unknown Pet"
  const petType = reel.pets?.type || "pet"

  // Use the helper function to safely process pet image URLs
  const petAvatar = processImageUrl(reel.pets?.avatar_url)
  const petPhoto = processImageUrl(reel.pets?.photo_url)
  const petImage = processImageUrl(reel.pets?.image_url)

  // Only use actual valid image URLs, not placeholder URLs
  const petImageUrl = petAvatar || petPhoto || petImage

  // Get dynamic mood information
  const moodInfo = getMoodInfo(reel.mood)

  // Handle delete button click
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteReel(id)
      if (result.success) {
        toast({
          title: "Success",
          description: "Pet tale deleted successfully",
        })
        setShowDeleteDialog(false)
        router.refresh() // Refresh the page to update the list
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete pet tale",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card
        className={`overflow-hidden h-full transition-all duration-200 hover:shadow-md dark:border-gray-700 ${className}`}
      >
        <div className="flex items-center p-4 border-b border-muted/50 dark:border-gray-700 relative">
          {/* Delete button in the upper right corner */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => setShowDeleteDialog(true)}
            aria-label="Delete pet tale"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Pet avatar in circular frame */}
          <Avatar className="h-14 w-14 border-2 border-white dark:border-gray-800 shadow-sm mr-3">
            <AvatarImage src={petImageUrl || undefined} alt={petName} />
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
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-medium text-base line-clamp-1 text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{formattedDate}</span>
              <span>•</span>
              <span>{metrics.viewCount} views</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {metrics.likeCount}
              </span>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-center text-teal-600 border-teal-200 hover:bg-teal-50 hover:text-teal-700 h-9 px-3 text-sm dark:text-teal-400 dark:border-teal-800 dark:hover:bg-teal-900/30 dark:hover:text-teal-300 bg-transparent"
          >
            <Link href={`/dashboard/reels/${id}`} className="flex items-center justify-center">
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Pet Tale</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this pet tale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:border-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 dark:bg-red-700 dark:hover:bg-red-800 dark:text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
