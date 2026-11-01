import { redirect } from "next/navigation"

interface DashboardPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  console.log("🔐 DASHBOARD ROOT - Redirecting to pets with params:", searchParams)

  // Preserve any search parameters when redirecting to pets
  const params = new URLSearchParams()

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) {
        const stringValue = Array.isArray(value) ? value[0] : value
        params.set(key, stringValue)
      }
    })
  }

  const redirectUrl = params.toString() ? `/dashboard/pets?${params.toString()}` : "/dashboard/pets"

  console.log("🔐 DASHBOARD ROOT - Final redirect URL:", redirectUrl)
  redirect(redirectUrl)
}
