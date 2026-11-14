import { talePosterUrl } from "@/lib/tale-poster-url"

type AvatarPet = { image_url?: string | null; avatar_url?: string | null; photo_url?: string | null }

/** The pet's own photo, or else a frame from its latest finished tale, or null (initial letter). */
export function petAvatarUrl(pet: AvatarPet, latestTaleId?: string | null): string | null {
  const own = [pet.image_url, pet.avatar_url, pet.photo_url].find((u) => typeof u === "string" && u.startsWith("http"))
  if (own) return own
  return latestTaleId ? talePosterUrl(latestTaleId) : null
}
