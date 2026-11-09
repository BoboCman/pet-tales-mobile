/** Poster frame saved for each finished tale. Plain module so server components can call it too. */
export function talePosterUrl(id: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/videos/thumbnails/pet-tale-${id}.jpg` : null
}
