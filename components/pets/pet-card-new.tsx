"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Pencil, Video, Film, PawPrint, Sparkles } from "lucide-react"
import { isPersonalized } from "@/lib/pets/personality"
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
  const personalized = isPersonalized(pet)

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
            {personalized && personalityTraitsText && (
              <div className="mt-1">
                <p className="text-xs text-teal-600 font-medium">{personalityTraitsText}</p>
              </div>
            )}
          </div>
        </div>
        {/* Personality drives the narration voice, so it gets a clear spot instead of hiding behind "Edit" */}
        {personalized ? (
          <Link
            href={`/dashboard/pets/${pet.id}/personality?next=/dashboard/pets`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-100 px-3 py-2 min-h-[44px]"
          >
            <span className="flex items-center gap-2 text-sm text-teal-800">
              <Sparkles className="h-4 w-4 text-teal-600" />
              Voice tuned to {pet.name}
            </span>
            <span className="text-sm font-medium text-teal-700">Adjust</span>
          </Link>
        ) : (
          <Link
            href={`/dashboard/pets/${pet.id}/personality?next=/dashboard/pets`}
            onClick={(e) => e.stopPropagation()}
            className="block rounded-xl bg-gradient-to-r from-amber-50 to-teal-50 border border-amber-200 px-4 py-3"
          >
            <p className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Make tales sound like {pet.name}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">6 quick taps. Tell us who {pet.name} really is.</p>
            <span className="mt-2 inline-flex items-center text-sm font-semibold text-teal-700">
              Tell us about {pet.name} →
            </span>
          </Link>
        )}

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white" asChild>
            <Link href={`/dashboard/reels/new?pet=${pet.id}`} onClick={(e) => e.stopPropagation()}>
              <Video className="mr-2 h-4 w-4" />
              New Tale
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 h-11 bg-white hover:bg-teal-50 text-teal-700 border border-teal-200"
            asChild
          >
            <Link href={`/dashboard/reels?pet=${pet.id}`} onClick={(e) => e.stopPropagation()}>
              <Film className="mr-2 h-4 w-4 text-teal-600" />
              Tales
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0 text-gray-500"
            onClick={handleEdit}
            aria-label={`Edit ${pet.name}'s name, photo and breed`}
          >
            <Pencil className="h-4 w-4" />
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
