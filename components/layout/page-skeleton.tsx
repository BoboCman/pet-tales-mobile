/**
 * Instant placeholder shown by loading.tsx while a dashboard page renders on the server.
 * Having a loading boundary also lets Next.js prefetch these routes, so a tap on the bottom nav
 * changes the screen right away instead of waiting on the server.
 */
export function PageSkeleton({ variant = "grid" }: { variant?: "grid" | "list" }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto min-h-screen max-w-4xl bg-white pb-28 dark:bg-gray-950"
    >
      <div className="px-4 pt-5">
        <div className="h-7 w-36 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      </div>
      {variant === "grid" ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="space-y-3 px-4 pt-6">
          <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        </div>
      )}
    </div>
  )
}
