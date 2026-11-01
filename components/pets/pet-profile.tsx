"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PawPrintIcon as Paw } from "lucide-react"
import { clientLogger } from "@/lib/client-logger"
import { useEffect } from "react"

interface Pet {
  id: string
  name: string
  type: string
  breed: string | null
  pet_age: string | null
  gender: string
  image_url: string | null
  personality_energy?: number | null
  personality_sociability?: number | null
  personality_confidence?: number | null
  personality_obedience?: number | null
  personality_play_style?: number | null
  personality_curiosity?: number | null
  personality_territorial?: number | null
  created_at: string
}

interface PetProfileProps {
  pet: Pet
}

const personalityLabels = {
  energy: ["Zen Master", "Couch Potato", "Balanced", "Peppy", "Zoomies!"],
  sociability: ["Lone Wolf", "Selective Socializer", "Friendly", "Party Animal", "Velcro Pet"],
  confidence: ["Shy Bean", "Cautious Paws", "Steady", "Brave", "Fearless Leader"],
  obedience: ["Free Spirit", "Negotiator", "Tries Their Best", "Rule Follower", "Teacher's Pet"],
  playStyle: ["Chess Master", "Gentle Player", "Playful", "Bouncy", "Wild Child"],
  curiosity: ["Unbothered", "Occasionally Interested", "Inquisitive", "Inspector", "Trouble Finder"],
  territorial: ["Sharing is Caring", "Easy-Going", "Mine Sometimes", "Protector", "Guardian Supreme"],
}

export function PetProfile({ pet }: PetProfileProps) {
  useEffect(() => {
    clientLogger.info("PetManagement", "Pet profile viewed", pet.name)
    clientLogger.dev("PetManagement", "Pet profile data", {
      petId: pet.id,
      petType: pet.type,
      hasImage: !!pet.image_url,
    })
  }, [pet])

  // Handle image URL - support both full URLs and storage paths
  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null

    // If it's already a full URL, return as is
    if (imageUrl.startsWith("http")) {
      return imageUrl
    }

    // If it's a storage path, construct the full URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/pet-photo/${imageUrl}`
    }

    return imageUrl
  }

  const imageUrl = getImageUrl(pet.image_url)

  const getPersonalityLabel = (trait: keyof typeof personalityLabels, value: number | null) => {
    if (!value || value < 1 || value > 5) return null
    return personalityLabels[trait][value - 1]
  }

  const renderPersonalityTrait = (label: string, value: number | null, trait: keyof typeof personalityLabels) => {
    if (!value) return null

    const personalityLabel = getPersonalityLabel(trait, value)
    const percentage = (value / 5) * 100

    return (
      <div key={trait} className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-teal-600 font-semibold">{personalityLabel}</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pet Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Pet Photo */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl || "/placeholder.svg"}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                      target.nextElementSibling?.classList.remove("hidden")
                      clientLogger.dev("PetManagement", "Pet profile image failed to load", { petId: pet.id })
                    }}
                    onLoad={() => {
                      clientLogger.dev("PetManagement", "Pet profile image loaded successfully", { petId: pet.id })
                    }}
                  />
                ) : null}
                <div className={`${imageUrl ? "hidden" : ""}`}>
                  <Paw className="h-16 w-16 text-teal-400" />
                </div>
              </div>
            </div>

            {/* Pet Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold">{pet.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">
                    {pet.type}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {pet.gender}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {pet.breed && (
                  <div>
                    <span className="font-medium text-muted-foreground">Breed:</span>
                    <p>{pet.breed}</p>
                  </div>
                )}
                {pet.pet_age && (
                  <div>
                    <span className="font-medium text-muted-foreground">Age:</span>
                    <p>{pet.pet_age}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-muted-foreground">Added:</span>
                  <p>{new Date(pet.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personality Traits */}
      <Card>
        <CardHeader>
          <CardTitle>Personality Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Common Traits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Common Traits</h3>
            <div className="space-y-4">
              {renderPersonalityTrait("Energy Level", pet.personality_energy, "energy")}
              {renderPersonalityTrait("Sociability", pet.personality_sociability, "sociability")}
              {renderPersonalityTrait("Confidence", pet.personality_confidence, "confidence")}
            </div>
          </div>

          {/* Dog-specific traits */}
          {pet.type === "dog" && (pet.personality_obedience || pet.personality_play_style) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Dog Traits</h3>
              <div className="space-y-4">
                {renderPersonalityTrait("Obedience", pet.personality_obedience, "obedience")}
                {renderPersonalityTrait("Play Style", pet.personality_play_style, "playStyle")}
              </div>
            </div>
          )}

          {/* Cat-specific traits */}
          {pet.type === "cat" && (pet.personality_curiosity || pet.personality_territorial) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Cat Traits</h3>
              <div className="space-y-4">
                {renderPersonalityTrait("Curiosity", pet.personality_curiosity, "curiosity")}
                {renderPersonalityTrait("Territorial", pet.personality_territorial, "territorial")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
