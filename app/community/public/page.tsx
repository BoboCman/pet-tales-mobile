import type { Metadata } from "next"
import { Suspense } from "react"
import CommunityPublicPageClient from "./CommunityPublicPageClient"
import Loading from "./loading"

export const metadata: Metadata = {
  title: "Community Spotlight",
  description:
    "Discover heartwarming pet stories from the Pet Tale AI community. Watch AI-narrated pet videos and get inspired to create your own.",
  alternates: {
    canonical: "https://www.pettaleai.com/community/public",
  },
  openGraph: {
    title: "Community Spotlight | Pet Tale AI",
    description: "Discover heartwarming pet stories from the Pet Tale AI community. Watch AI-narrated pet videos.",
  },
}

export default function CommunityPublicPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CommunityPublicPageClient />
    </Suspense>
  )
}
