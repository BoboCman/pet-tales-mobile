import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-20">
      {/* Hero Section Skeleton */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/20 to-blue-600/20 dark:from-teal-400/10 dark:to-blue-400/10" />
        <div className="relative container mx-auto px-4 py-12 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="h-16 w-96 mx-auto mb-6" />
            <Skeleton className="h-6 w-full max-w-2xl mx-auto mb-8" />
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-12 w-48" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section Skeleton */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Skeleton className="h-8 w-8 mx-auto mb-2" />
                <Skeleton className="h-8 w-16 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tales Grid Skeleton */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden h-full">
                {/* Header section skeleton */}
                <div className="flex items-center p-4 border-b border-muted/50">
                  <Skeleton className="h-14 w-14 rounded-full mr-3" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                {/* Content section skeleton */}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <div className="flex items-center gap-2 mt-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-1" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-1" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom CTA Skeleton */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-teal-500 to-blue-600 text-white border-0">
            <CardContent className="p-8">
              <Skeleton className="h-8 w-64 mx-auto mb-4 bg-white/20" />
              <Skeleton className="h-4 w-full max-w-2xl mx-auto mb-6 bg-white/20" />
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Skeleton className="h-12 w-48 bg-white/20" />
                <Skeleton className="h-12 w-48 bg-white/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
