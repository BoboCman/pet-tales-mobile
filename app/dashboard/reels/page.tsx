import { Suspense } from "react"
import Link from "next/link"
import { Plus, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReelCard } from "@/components/reels/reel-card"
import { getDiaryEntries } from "@/app/actions/diary-actions"
import { EmptyState } from "@/components/ui/empty-state"

export const dynamic = "force-dynamic"

// Loading skeleton component
function ReelCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      <div className="flex items-center p-4 border-b border-gray-100">
        <div className="h-14 w-14 rounded-full bg-gray-200 mr-3"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        <div className="h-9 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}

function ReelsGrid() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReelCardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <ReelsContent />
    </Suspense>
  )
}

async function ReelsContent() {
  const result = await getDiaryEntries()

  if (!result.success) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading pet tales: {result.error}</p>
      </div>
    )
  }

  const reels = result.entries || []

  if (reels.length === 0) {
    return (
      <EmptyState
        icon={<Video className="h-12 w-12 text-teal-600" />}
        title="No Pet Tales Yet"
        description="Create your first pet tale to start sharing magical stories"
        action={
          <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
            <Link href="/dashboard/reels/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Tale
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {reels.map((reel) => (
        <ReelCard key={reel.id} reel={reel} />
      ))}
    </div>
  )
}

export default function ReelsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-teal-600 text-white py-6 px-4 md:py-8">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Pet Tales</h1>
              <p className="text-teal-50 text-sm md:text-base">Watch and share your pet's magical video stories</p>
            </div>
            <Button asChild className="bg-white text-teal-600 hover:bg-teal-50 font-medium px-6 py-2 w-full md:w-auto">
              <Link href="/dashboard/reels/new">
                <Plus className="h-4 w-4 mr-2" />
                Create New Tale
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto max-w-4xl py-4 px-3">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <Suspense fallback={<div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>}>
            <ReelsHeader />
          </Suspense>
          <Button
            asChild
            variant="outline"
            className="text-teal-600 border-teal-200 hover:bg-teal-50 hidden sm:flex bg-transparent"
          >
            <Link href="/dashboard/reels/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Tale
            </Link>
          </Button>
        </div>

        {/* Reels Grid */}
        <ReelsGrid />
      </div>
    </div>
  )
}

async function ReelsHeader() {
  const result = await getDiaryEntries()
  const reelsCount = result.success ? (result.entries || []).length : 0

  return <h2 className="text-xl font-semibold text-gray-900">My Pet Tales ({reelsCount})</h2>
}
