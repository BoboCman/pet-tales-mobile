import { notFound } from "next/navigation"
import { getPetById } from "@/lib/supabase/server"
import { PetForm } from "@/components/pets/pet-form"

export const dynamic = "force-dynamic"

export default async function EditPetPage({ params }: { params: { id: string } }) {
  const pet = await getPetById(params.id)
  if (!pet) notFound()
  return <PetForm pet={pet} />
}
