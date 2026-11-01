import { notFound } from "next/navigation"
import { getPetById } from "@/lib/supabase/server"
import { PetFormNew } from "@/components/pets/pet-form-new"

interface EditPetPageProps {
  params: {
    id: string
  }
}

export default async function EditPetPage({ params }: EditPetPageProps) {
  const pet = await getPetById(params.id)

  if (!pet) {
    notFound()
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Edit Pet</h2>
        <p className="text-muted-foreground">Update your pet's information and personality traits.</p>
      </div>
      <PetFormNew initialData={pet} petId={params.id} />
    </div>
  )
}
