import { notFound } from "next/navigation"
import { getPetById } from "@/lib/supabase/server"
import { PersonalityQuiz } from "@/components/pets/personality-quiz"

export const dynamic = "force-dynamic"

export default async function PetPersonalityPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { next?: string; welcome?: string }
}) {
  const pet = await getPetById(params.id)
  if (!pet) notFound()
  return <PersonalityQuiz pet={pet} next={searchParams?.next} welcome={searchParams?.welcome === "1"} />
}
