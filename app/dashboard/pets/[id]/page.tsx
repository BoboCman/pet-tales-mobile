import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getPetById } from "@/lib/supabase/server"
import { PetProfile } from "@/components/pets/pet-profile"
import { ArrowLeft, Pencil } from "lucide-react"

interface PetDetailPageProps {
  params: {
    id: string
  }
}

export default async function PetDetailPage({ params }: PetDetailPageProps) {
  const pet = await getPetById(params.id)

  if (!pet) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/pets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pets
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={`/dashboard/pets/${pet.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Pet
          </Link>
        </Button>
      </div>

      <PetProfile pet={pet} />

      <div className="grid gap-6 md:grid-cols-2">{/* Additional pet information or sections can be added here */}</div>
    </div>
  )
}
