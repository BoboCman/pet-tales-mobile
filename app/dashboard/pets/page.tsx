import Link from "next/link"
import { PawPrint, Plus, Video } from "lucide-react"
import { getUserDetails, getPets, createClient } from "@/lib/supabase/server"
import { PetCardNew, type PetCardPet } from "@/components/pets/pet-card-new"
import { getPackOffer } from "@/lib/stripe/pack-offer"
import { packLabel, startingPrice } from "@/lib/pricing-config"

export const dynamic = "force-dynamic"

interface PetsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function PetsPage({ searchParams }: PetsPageProps) {
  const newUser = searchParams?.newUser === "true" || searchParams?.from === "signup"

  const [user, pets, pack] = await Promise.all([getUserDetails(), getPets(), getPackOffer()])

  // Tales left (to flag when it's time for a plan) and finished tales per pet
  let talesLeft: number | null = null
  const taleCounts: Record<string, number> = {}
  const latestTale: Record<string, string> = {}
  if (user?.id) {
    const supabase = createClient()
    const [{ data: balance }, { data: entries }] = await Promise.all([
      supabase.from("users").select("free_credits, purchased_credits").eq("id", user.id).maybeSingle(),
      supabase
        .from("diary_entries")
        .select("id, pet_id")
        .eq("user_id", user.id)
        .neq("billing_status", "billing_required")
        .eq("merged_video_status", "completed")
        .not("merged_video_url", "is", null)
        .order("created_at", { ascending: false }),
    ])
    if (balance) talesLeft = (balance.free_credits ?? 0) + (balance.purchased_credits ?? 0)
    for (const e of entries || []) {
      if (!e.pet_id) continue
      taleCounts[e.pet_id] = (taleCounts[e.pet_id] || 0) + 1
      latestTale[e.pet_id] ??= e.id
    }
  }

  if (pets.length === 0) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center bg-white px-6 text-center dark:bg-gray-950">
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-50 dark:bg-teal-900/30">
          <PawPrint className="h-10 w-10 text-teal-600" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {newUser ? "Welcome to Pet Tale" : "No pets yet"}
        </h1>
        <p className="mt-2 max-w-xs text-gray-500">
          Skip the forms. Pick a clip of your pet and we&apos;ll ask for their name right there.
        </p>
        <Link
          href="/dashboard/reels/new"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-teal-600 px-6 font-semibold text-white shadow-sm active:bg-teal-700"
        >
          <Video className="h-5 w-5" />
          Make your first tale
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-white pb-28 dark:bg-gray-950">
      {/* Title row */}
      <div className="flex items-end justify-between gap-3 px-4 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Your pets</h1>
          <p className="mt-0.5 text-sm text-gray-500">Every tale is told in their voice</p>
        </div>
        <Link
          href="/dashboard/pets/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add pet
        </Link>
      </div>

      {talesLeft === 0 && (
        <Link
          href="/pricing"
          className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 active:bg-amber-100 dark:bg-amber-900/20"
        >
          <span className="text-sm text-amber-900 dark:text-amber-200">You&apos;re out of tales</span>
          <span className="text-sm font-semibold text-teal-700 dark:text-teal-400">{pack ? `Get ${packLabel(pack)} →` : `See plans from ${startingPrice(null)} →`}
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 px-4 pt-4 sm:grid-cols-2">
        {pets.map((pet: PetCardPet) => (
          <PetCardNew key={pet.id} pet={pet} taleCount={taleCounts[pet.id] || 0} latestTaleId={latestTale[pet.id]} />
        ))}
      </div>
    </div>
  )
}
