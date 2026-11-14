"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronLeft, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useSupabase } from "@/lib/supabase/provider"
import { useDirectUpload } from "@/lib/supabase/client-storage"
import { cn } from "@/lib/utils"
import { AGES, BREEDS, DEFAULT_AGE, DEFAULT_BREED, POPULAR_BREEDS, type PetKind } from "@/lib/pets/options"
import { PetBasicsFields, newPetDefaults, type PetBasicsValues } from "./pet-basics"

export type EditablePet = {
  id: string
  name: string
  type: string | null
  gender: string | null
  breed: string | null
  pet_age: string | null
  image_url: string | null
}

const chip = (on: boolean) =>
  cn(
    "min-h-[40px] rounded-full border px-3 py-1.5 text-sm transition-colors",
    on
      ? "border-teal-600 bg-teal-600 text-white"
      : "border-gray-200 bg-white text-gray-800 active:border-teal-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  )

/** Add pet and Edit pet: the shared basics, plus breed and age folded under "More details". */
export function PetForm({ pet }: { pet?: EditablePet }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { uploadPetPhoto } = useDirectUpload()
  const { toast } = useToast()

  const [basics, setBasics] = useState<PetBasicsValues>({
    name: pet?.name ?? "",
    type: pet?.type === "cat" ? "cat" : "dog",
    gender: pet?.gender === "female" ? "female" : "male",
    photo: null,
  })
  const kind: PetKind = basics.type
  const [breed, setBreed] = useState<string | null>(pet?.breed ?? null)
  const [age, setAge] = useState<string | null>(pet?.pet_age ?? null)
  const [more, setMore] = useState(!!pet)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  // Switching dog/cat drops a breed or age that belongs to the other kind
  const breedFits = !breed || BREEDS[kind].includes(breed) || !Object.values(BREEDS).flat().includes(breed)
  const ageFits = !age || AGES[kind].some((a) => a.value === age)
  const shownBreed = breedFits ? breed : null
  const shownAge = ageFits ? age : null

  const breedChoices = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return POPULAR_BREEDS[kind]
    return BREEDS[kind].filter((b) => b.toLowerCase().includes(q)).slice(0, 12)
  }, [query, kind])
  const typed = query.trim()
  const offerTyped = typed.length > 1 && !BREEDS[kind].some((b) => b.toLowerCase() === typed.toLowerCase())

  const name = basics.name.trim()
  const currentImage = pet?.image_url && pet.image_url.startsWith("http") ? pet.image_url : null

  async function save() {
    if (!name) {
      toast({ title: "What's your pet's name?", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("You've been signed out. Please sign in again.")

      let image_url = pet?.image_url ?? null
      if (basics.photo) {
        image_url = await uploadPetPhoto(basics.photo).catch(() => null)
        if (!image_url) throw new Error("The photo didn't upload. Try again, or save without it.")
      }

      const details = {
        breed: shownBreed || DEFAULT_BREED[kind],
        pet_age: shownAge || DEFAULT_AGE[kind],
      }

      if (pet) {
        const update: Record<string, unknown> = {
          name,
          type: kind,
          gender: basics.gender,
          image_url,
          ...details,
          updated_at: new Date().toISOString(),
        }
        if (pet.type !== kind) {
          // Each kind has its own two traits; start the new ones in the middle
          Object.assign(update, {
            personality_obedience: kind === "dog" ? 3 : null,
            personality_play_style: kind === "dog" ? 3 : null,
            personality_curiosity: kind === "cat" ? 3 : null,
            personality_territorial: kind === "cat" ? 3 : null,
          })
        }
        const { error } = await supabase.from("pets").update(update).eq("id", pet.id).eq("user_id", user.id)
        if (error) throw error
        toast({ title: `${name} is updated` })
        router.push(`/dashboard/pets/${pet.id}`)
      } else {
        const { data, error } = await supabase
          .from("pets")
          .insert({ ...newPetDefaults(basics), ...details, image_url, user_id: user.id })
          .select("id")
          .single()
        if (error || !data) throw error ?? new Error("Couldn't save your pet. Please try again.")
        // Straight on to the optional personality step
        router.push(`/dashboard/pets/${data.id}/personality?next=/dashboard/pets&welcome=1`)
      }
      router.refresh()
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 pb-36 pt-4">
      <header className="space-y-1">
        <Link
          href={pet ? `/dashboard/pets/${pet.id}` : "/dashboard/pets"}
          className="-ml-1 inline-flex h-9 items-center text-sm font-medium text-gray-500 active:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {pet ? pet.name : "Your pets"}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pet ? `Edit ${pet.name}` : "Meet your pet"}</h1>
        {!pet && <p className="text-gray-500">Just the basics. You can tell us more any time.</p>}
      </header>

      <PetBasicsFields values={basics} onChange={setBasics} currentImage={currentImage} autoFocus={!pet} />

      <section className="rounded-2xl border border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex min-h-12 w-full items-center justify-between px-4 text-left"
        >
          <span>
            <span className="block font-semibold text-gray-900 dark:text-white">More details</span>
            <span className="block text-sm text-gray-500">
              {shownBreed || shownAge
                ? [shownBreed, AGES[kind].find((a) => a.value === shownAge)?.label].filter(Boolean).join(" · ")
                : "Breed and age (optional)"}
            </span>
          </span>
          <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform", more && "rotate-180")} />
        </button>

        {more && (
          <div className="space-y-5 px-4 pb-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Breed</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={kind === "dog" ? "Search, e.g. Beagle" : "Search, e.g. Persian"}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-base focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {shownBreed && !breedChoices.includes(shownBreed) && (
                  <button type="button" className={chip(true)} onClick={() => setBreed(null)}>
                    {shownBreed}
                  </button>
                )}
                {breedChoices.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={shownBreed === b}
                    className={chip(shownBreed === b)}
                    onClick={() => setBreed(shownBreed === b ? null : b)}
                  >
                    {b}
                  </button>
                ))}
                {offerTyped && (
                  <button
                    type="button"
                    className={chip(false)}
                    onClick={() => {
                      setBreed(typed.slice(0, 60))
                      setQuery("")
                    }}
                  >
                    Use &ldquo;{typed}&rdquo;
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Age</h2>
              <div className="flex flex-wrap gap-2">
                {AGES[kind].map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={shownAge === a.value}
                    className={chip(shownAge === a.value)}
                    onClick={() => setAge(shownAge === a.value ? null : a.value)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:bg-gray-950/95">
        <div className="mx-auto max-w-md">
          <Button onClick={save} disabled={saving || !name} className="h-12 w-full bg-teal-600 text-base hover:bg-teal-700">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pet ? "Save changes" : name ? `Add ${name}` : "Add pet"}
          </Button>
        </div>
      </div>
    </div>
  )
}
