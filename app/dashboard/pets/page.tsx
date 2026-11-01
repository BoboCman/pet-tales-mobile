import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getUserDetails, getPets } from "@/lib/supabase/server"
import { PlusCircle, ArrowRight } from "lucide-react"
import { PetCardNew } from "@/components/pets/pet-card-new"
import { EmptyState } from "@/components/ui/empty-state"

export const dynamic = "force-dynamic"

interface PetsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function PetsPage({ searchParams }: PetsPageProps) {
  console.log("🐾 PETS PAGE - Loading with searchParams:", searchParams)

  // Extract redirect-related parameters
  const from = searchParams?.from as string | undefined
  const newUser = searchParams?.newUser === "true"
  const fromSignup = from === "signup"
  const fromSignin = from === "signin"

  console.log("🐾 PETS PAGE - Auth parameters:", {
    from,
    newUser,
    fromSignup,
    fromSignin,
  })

  // Get user and pets data
  const user = await getUserDetails()
  const pets = await getPets()

  console.log("🐾 PETS PAGE - Data loaded:", {
    hasUser: !!user,
    petCount: pets.length,
    userId: user?.id,
  })

  // Determine if this is a post-authentication landing
  const isPostAuth = fromSignup || fromSignin
  const isNewUser = newUser || (pets.length === 0 && fromSignup)
  const userName = user?.user_metadata?.username || user?.email?.split("@")[0]

  console.log("🐾 PETS PAGE - State analysis:", {
    isPostAuth,
    isNewUser,
    shouldShowWelcome: isPostAuth || isNewUser,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero section */}
      <div className="bg-teal-600 text-white py-6 px-4 md:py-8">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-4">
            <h1 className="text-xl md:text-3xl font-bold mb-2">Pet Dashboard</h1>
            {isPostAuth && userName && <p className="text-teal-100 text-base md:text-lg">Welcome back, {userName}!</p>}
          </div>
          <p className="text-teal-50 text-sm md:text-base mb-4">
            {isNewUser
              ? "Welcome to Pet Tales AI! Add your first pet to start creating amazing stories."
              : "Manage your pet profiles and create personalized stories"}
          </p>
          <Button asChild className="bg-white text-teal-600 hover:bg-teal-50 w-full md:w-auto h-12 md:h-10 text-base">
            <Link href="/dashboard/pets/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {pets.length === 0 ? "Add Your First Pet" : "Add New Pet"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Content container */}
      <div className="container mx-auto max-w-4xl py-4 px-3">
        {/* Results header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">
            My Pets
            {pets.length > 0 && <span className="text-sm font-normal text-muted-foreground ml-1">({pets.length})</span>}
          </h2>
          {pets.length > 0 && (
            <Button variant="ghost" className="text-teal-600 h-10 px-2 text-sm" asChild>
              <Link href="/dashboard/reels">
                View Tales <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {/* Pet Grid or Empty State */}
        {pets.length === 0 ? (
          <div className="col-span-full text-center py-6">
            <EmptyState
              title={isNewUser ? "Let's add your first pet!" : "No pets added yet"}
              description={
                isNewUser
                  ? "Create a profile for your furry friend to start generating their personalized AI stories."
                  : "Add your first pet to start creating personalized stories."
              }
              icon={<PlusCircle className="h-10 w-10" />}
              action={
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white w-full h-12 text-base hover:scale-105 transition-transform"
                  asChild
                >
                  <Link href="/dashboard/pets/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Your First Pet
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {pets.map((pet) => (
              <PetCardNew key={pet.id} pet={pet} linkToDetail={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
