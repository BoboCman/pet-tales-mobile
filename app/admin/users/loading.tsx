export default function Loading() {
  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    </div>
  )
}
