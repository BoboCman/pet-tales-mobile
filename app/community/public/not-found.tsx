import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-400 mb-6">
                <Heart className="h-16 w-16 mx-auto" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Tale Not Found</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The pet tale you're looking for doesn't exist or is no longer available.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild>
                  <Link href="/community/public">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Community
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/auth/signup">Join Our Community</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
