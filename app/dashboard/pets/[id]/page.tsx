import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight, Film, Pencil, Plus, Sparkles } from "lucide-react"
import { createClient, getPetById } from "@/lib/supabase/server"
import { PetAvatar } from "@/components/reels/tale-poster"
import { petAvatarUrl } from "@/lib/pets/avatar"
import { AGES } from "@/lib/pets/options"
import { isPersonalized, traitQuestions } from "@/lib/pets/personality"

export const dynamic = "force-dynamic"

export default async function PetDetailPage({ params }: { params: { id: string } }) {
  const pet = await getPetById(params.id)
  if (!pet) notFound()

  const supabase = createClient()
  const { data: tales } = await supabase
    .from("diary_entries")
    .select("id")
    .eq("pet_id", pet.id)
    .eq("merged_video_status", "completed")
    .neq("billing_status", "billing_required")
    .not("merged_video_url", "is", null)
    .order("created_at", { ascending: false })
  const taleCount = tales?.length ?? 0

  const kind = pet.type === "cat" ? "cat" : "dog"
  const ageLabel = AGES[kind].find((a) => a.value === pet.pet_age)?.label
  const facts = [pet.breed, ageLabel, pet.gender === "female" ? "Girl" : pet.gender === "male" ? "Boy" : null].filter(
    Boolean,
  )
  const personalized = isPersonalized(pet)
  const traits = traitQuestions(pet.type)
    .map((q) => {
      const v = pet[q.key]
      return typeof v === "number" && v >= 1 && v <= 5 ? q.options[v - 1] : null
    })
    .filter((o): o is { label: string; emoji: string } => !!o)

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-28 pt-4">
      <Link
        href="/dashboard/pets"
        className="-ml-1 inline-flex h-9 items-center text-sm font-medium text-gray-500 active:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Your pets
      </Link>

      <header className="flex flex-col items-center text-center">
        <Link href={`/dashboard/pets/${pet.id}/edit`} aria-label={`Change ${pet.name}'s photo`}>
          <PetAvatar name={pet.name} image={petAvatarUrl(pet, tales?.[0]?.id)} className="h-28 w-28 text-4xl" />
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{pet.name}</h1>
        {facts.length > 0 && <p className="mt-0.5 text-sm text-gray-500">{facts.join(" · ")}</p>}
        <div className="mt-4 flex w-full gap-2">
          <Link
            href={`/dashboard/reels/new?pet=${pet.id}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-teal-600 font-semibold text-white active:bg-teal-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New tale
          </Link>
          <Link
            href={`/dashboard/pets/${pet.id}/edit`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-gray-200 font-semibold text-gray-800 active:bg-gray-50 dark:border-gray-700 dark:text-gray-100"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </header>

      <Link
        href={`/dashboard/pets/${pet.id}/personality?next=/dashboard/pets/${pet.id}`}
        className={`block rounded-2xl p-4 ${
          personalized ? "bg-teal-50 active:bg-teal-100 dark:bg-teal-900/20" : "bg-amber-50 active:bg-amber-100 dark:bg-amber-900/20"
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className={`h-4 w-4 ${personalized ? "text-teal-600" : "text-amber-500"}`} />
          <span className="flex-1 font-semibold text-gray-900 dark:text-white">
            {personalized ? `${pet.name}'s personality` : `Make tales sound like ${pet.name}`}
          </span>
          <span className={`text-sm font-medium ${personalized ? "text-teal-700" : "text-amber-700"}`}>
            {personalized ? "Adjust" : "6 quick taps"}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
        {personalized && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {traits.map((t) => (
              <span key={t.label} className="rounded-full bg-white px-2.5 py-1 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                <span aria-hidden className="mr-1">
                  {t.emoji}
                </span>
                {t.label}
              </span>
            ))}
          </div>
        )}
        {personalized && pet.personality_quirks && (
          <p className="mt-2 text-sm italic text-gray-600 dark:text-gray-400">&ldquo;{pet.personality_quirks}&rdquo;</p>
        )}
      </Link>

      {taleCount > 0 && (
        <Link
          href={`/dashboard/reels?pet=${pet.id}`}
          className="flex h-12 items-center gap-3 rounded-2xl bg-gray-50 px-4 font-medium text-gray-900 active:bg-gray-100 dark:bg-gray-900 dark:text-white"
        >
          <Film className="h-5 w-5 text-teal-600" />
          <span className="flex-1">
            See {pet.name}&apos;s {taleCount} {taleCount === 1 ? "tale" : "tales"}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>
      )}
    </div>
  )
}
