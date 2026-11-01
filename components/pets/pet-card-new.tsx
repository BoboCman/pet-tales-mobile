"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Pencil, Video, Film, PawPrint } from "lucide-react"
import Link from "next/link"
import type { Database } from "@/lib/supabase/database.types"

type Pet = Database["public"]["Tables"]["pets"]["Row"]

interface PetCardNewProps {
  pet: Pet
  linkToDetail?: boolean
}

// Define the exact personality trait labels used in the PersonalityTraits component
const personalityLabels = {
  energy: ["Zen Master", "Couch Potato", "Balanced", "Peppy", "Zoomies!"],
  sociability: ["Lone Wolf", "Selective Socializer", "Friendly", "Party Animal", "Velcro Pet"],
  confidence: ["Shy Bean", "Cautious Paws", "Steady", "Brave", "Fearless Leader"],
  obedience: ["Free Spirit", "Negotiator", "Tries Their Best", "Rule Follower", "Teacher's Pet"],
  playStyle: ["Chess Master", "Gentle Player", "Playful", "Bouncy", "Wild Child"],
  curiosity: ["Unbothered", "Occasionally Interested", "Inquisitive", "Inspector", "Trouble Finder"],
  territorial: ["Sharing is Caring", "Easy-Going", "Mine Sometimes", "Protector", "Guardian Supreme"],
}

// Function to get the trait label based on the numeric value (1-5)
function getTraitLabel(trait: keyof typeof personalityLabels, value: number | null): string | null {
  if (value === null || value === undefined) return null
  if (value < 1 || value > 5) return null
  return personalityLabels[trait][value - 1]
}

export function PetCardNew({ pet, linkToDetail = false }: PetCardNewProps) {
  const router = useRouter()

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/dashboard/pets/${pet.id}/edit`)
  }

  // Get personality traits based on pet type
  const personalityTraits: string[] = []

  if (pet.type?.toLowerCase().includes("cat")) {
    // For cats: Curiosity and Territorial
    const curiosityTrait = getTraitLabel("curiosity", pet.personality_curiosity)
    const territorialTrait = getTraitLabel("territorial", pet.personality_territorial)
    if (curiosityTrait) personalityTraits.push(curiosityTrait)
    if (territorialTrait) personalityTraits.push(territorialTrait)
  } else {
    // For dogs and other pets: Obedience and Play Style
    const obedienceTrait = getTraitLabel("obedience", pet.personality_obedience)
    const playStyleTrait = getTraitLabel("playStyle", pet.personality_play_style)
    if (obedienceTrait) personalityTraits.push(obedienceTrait)
    if (playStyleTrait) personalityTraits.push(playStyleTrait)
  }

  // Create a dot-separated list of traits (using • character)
  const personalityTraitsText = personalityTraits.join(" • ")

  const cardContent = (
    <Card className="overflow-hidden h-full transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={pet.image_url || undefined} alt={pet.name} />
            <AvatarFallback className="bg-green-100 text-green-600">
              <PawPrint className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h3 className="text-lg font-bold">{pet.name}</h3>
            <p className="text-sm text-muted-foreground">{pet.breed || "Unknown breed"}</p>
            {/* Personality traits as dot-separated list */}
            {personalityTraitsText && (
              <div className="mt-1">
                <p className="text-xs text-teal-600 font-medium">{personalityTraitsText}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-gray-200 bg-transparent"
              onClick={handleEdit}
            >
              <Pencil className="mr-2 h-4 w-4 text-gray-400" />
              Edit
            </Button>
            <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" asChild>
              <Link href={`/dashboard/reels/new?pet=${pet.id}`} onClick={(e) => e.stopPropagation()}>
                <Video className="mr-2 h-4 w-4" />
                New Tale
              </Link>
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200"
            asChild
          >
            <Link href={`/dashboard/reels?pet=${pet.id}`} onClick={(e) => e.stopPropagation()}>
              <Film className="mr-2 h-4 w-4 text-teal-600" />
              View Tales
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  if (linkToDetail) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/dashboard/pets/${pet.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/dashboard/pets/${pet.id}`)
          }
        }}
        className="block h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-600"
      >
        {cardContent}
      </div>
    )
  }

  return cardContent
}
