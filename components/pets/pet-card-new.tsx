"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Film, MoreHorizontal, Pencil, Plus, Sparkles } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { PetAvatar } from "@/components/reels/tale-poster"
import { petAvatarUrl } from "@/lib/pets/avatar"
import { isPersonalized, type PersonalityPet } from "@/lib/pets/personality"

export type PetCardPet = PersonalityPet & {
  id: string
  name: string
  breed?: string | null
  image_url?: string | null
  avatar_url?: string | null
  photo_url?: string | null
}

// Same trait labels as the PersonalityTraits component
const personalityLabels = {
  obedience: ["Free Spirit", "Negotiator", "Tries Their Best", "Rule Follower", "Teacher's Pet"],
  playStyle: ["Chess Master", "Gentle Player", "Playful", "Bouncy", "Wild Child"],
  curiosity: ["Unbothered", "Occasionally Interested", "Inquisitive", "Inspector", "Trouble Finder"],
  territorial: ["Sharing is Caring", "Easy-Going", "Mine Sometimes", "Protector", "Guardian Supreme"],
}

const label = (trait: keyof typeof personalityLabels, value: number | null | undefined) =>
  value && value >= 1 && value <= 5 ? personalityLabels[trait][value - 1] : null

export function PetCardNew({
  pet,
  taleCount = 0,
  latestTaleId,
}: {
  pet: PetCardPet
  taleCount?: number
  latestTaleId?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const personalized = isPersonalized(pet)
  const isCat = pet.type?.toLowerCase().includes("cat")
  const traits = (
    isCat
      ? [label("curiosity", pet.personality_curiosity), label("territorial", pet.personality_territorial)]
      : [label("obedience", pet.personality_obedience), label("playStyle", pet.personality_play_style)]
  ).filter(Boolean)

  const image = petAvatarUrl(pet, latestTaleId)
  const kind = pet.breed || (pet.type ? pet.type.charAt(0).toUpperCase() + pet.type.slice(1) : "Pet")
  const personalityHref = `/dashboard/pets/${pet.id}/personality?next=/dashboard/pets`

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/pets/${pet.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <PetAvatar name={pet.name} image={image} className="h-14 w-14 text-xl" />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-gray-900 dark:text-white">{pet.name}</span>
            <span className="block truncate text-sm text-gray-500">
              {taleCount > 0 && `${taleCount} ${taleCount === 1 ? "tale" : "tales"} · `}
              {kind}
            </span>
          </span>
        </Link>
        <Link
          href={`/dashboard/reels/new?pet=${pet.id}`}
          aria-label={`New tale with ${pet.name}`}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-teal-50 px-3.5 text-sm font-semibold text-teal-700 active:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Tale
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={`More options for ${pet.name}`}
          className="flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 active:bg-gray-100 dark:active:bg-gray-800"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Personality drives the narration, so it keeps a visible, one-line spot */}
      <Link
        href={personalityHref}
        className={
          personalized
            ? "mt-3 flex min-h-11 items-center gap-2.5 rounded-xl bg-teal-50 px-3 py-2 active:bg-teal-100 dark:bg-teal-900/20"
            : "mt-3 flex min-h-11 items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2 active:bg-amber-100 dark:bg-amber-900/20"
        }
      >
        <Sparkles className={personalized ? "h-4 w-4 shrink-0 text-teal-600" : "h-4 w-4 shrink-0 text-amber-500"} />
        <span className="min-w-0 flex-1">
          {personalized ? (
            <span className="block truncate text-sm text-teal-900 dark:text-teal-100">
              {traits.length ? traits.join(" · ") : `Voice tuned to ${pet.name}`}
            </span>
          ) : (
            <>
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                Make tales sound like {pet.name}
              </span>
              <span className="block text-xs text-gray-600 dark:text-gray-400">6 quick taps</span>
            </>
          )}
        </span>
        {personalized ? (
          <span className="shrink-0 text-sm font-medium text-teal-700 dark:text-teal-400">Adjust</span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
        )}
      </Link>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen} shouldScaleBackground={false}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{pet.name}</DrawerTitle>
            <DrawerDescription>
              {kind}
              {taleCount > 0 ? ` · ${taleCount} ${taleCount === 1 ? "tale" : "tales"}` : " · No tales yet"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {taleCount > 0 && (
              <Link
                href={`/dashboard/reels?pet=${pet.id}`}
                className="flex h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 font-medium text-gray-900 active:bg-gray-100 dark:bg-gray-800 dark:text-white"
              >
                <Film className="h-5 w-5 text-teal-600" />
                See {pet.name}&apos;s tales
              </Link>
            )}
            <Link
              href={personalityHref}
              className="flex h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 font-medium text-gray-900 active:bg-gray-100 dark:bg-gray-800 dark:text-white"
            >
              <Sparkles className="h-5 w-5 text-teal-600" />
              {personalized ? `Adjust ${pet.name}'s personality` : `Tell us about ${pet.name}`}
            </Link>
            <Link
              href={`/dashboard/pets/${pet.id}/edit`}
              className="flex h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 font-medium text-gray-900 active:bg-gray-100 dark:bg-gray-800 dark:text-white"
            >
              <Pencil className="h-5 w-5 text-teal-600" />
              Edit name, photo, breed and age
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
