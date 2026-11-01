import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tale Not Found</h1>
        <p className="text-gray-600 mb-4">The requested pet tale could not be found.</p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
          <Link href="/community">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Link>
        </Button>
      </div>
    </div>
  )
}
