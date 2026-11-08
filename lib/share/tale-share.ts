import type { Metadata } from "next"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const SITE_URL = "https://www.pettaleai.com"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ShareableTale = {
  id: string
  title: string
  petName: string
  isPublic: boolean
  videoUrl: string
  posterUrl: string | null
}

/**
 * A finished tale as it may be shown to anyone holding its link. Exposes only what the shared
 * video itself already shows (title, pet name, the video); the link has always been viewable
 * by anyone who has it.
 */
export async function getShareableTale(id: string): Promise<ShareableTale | null> {
  if (!UUID_RE.test(id)) return null
  const { data } = await supabaseAdmin
    .from("diary_entries")
    .select("id, title, is_public, merged_video_status, merged_video_supabase_url, pets(name)")
    .eq("id", id)
    .maybeSingle()
  const row = data as any
  if (!row || row.merged_video_status !== "completed" || !row.merged_video_supabase_url) return null

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const posterUrl = supabaseBase
    ? `${supabaseBase}/storage/v1/object/public/videos/thumbnails/pet-tale-${row.id}.jpg`
    : null
  const posterOk = posterUrl ? await fetch(posterUrl, { method: "HEAD" }).then((r) => r.ok).catch(() => false) : false

  return {
    id: row.id,
    title: row.title || "A Pet Tale",
    petName: row.pets?.name || "My pet",
    isPublic: Boolean(row.is_public),
    videoUrl: `${SITE_URL}/video/${row.id}.mp4`,
    posterUrl: posterOk ? posterUrl : null,
  }
}

/** Link-preview tags (iMessage, WhatsApp, Facebook, X) for a shared tale. */
export function taleMetadata(tale: ShareableTale, pagePath: string): Metadata {
  const title = `${tale.petName}: ${tale.title}`
  const description = `Watch ${tale.petName}'s tale, narrated in their own voice. Make one for your pet free at pettaleai.com.`
  const image = tale.posterUrl || `${SITE_URL}/og-image.png`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${pagePath}` },
    // Private tales can be shared by link but are kept out of search results
    robots: tale.isPublic ? undefined : { index: false, follow: false },
    openGraph: {
      type: "video.other",
      url: `${SITE_URL}${pagePath}`,
      siteName: "Pet Tale AI",
      title,
      description,
      images: [{ url: image, alt: title }],
      videos: [{ url: tale.videoUrl, secureUrl: tale.videoUrl, type: "video/mp4", width: 720, height: 1280 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}
