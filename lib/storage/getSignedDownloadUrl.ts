import { supabaseAdmin } from "@/lib/supabase/admin"
import { ensureSocialVersion } from "@/lib/video/social-version"

interface SignedDownloadResult {
  url: string
  expiresAt: Date
  filename: string
}

/**
 * Creates a signed download URL for a diary entry's social-ready MP4 video
 * @param entryId - The diary entry ID
 * @param proposedFilename - Optional custom filename (will be sanitized)
 * @returns Promise with signed URL, expiry date, and sanitized filename
 */
export async function getSignedDownloadUrl(
  entryId: string,
  proposedFilename?: string,
  variant: "original" | "social" = "original",
): Promise<SignedDownloadResult> {
  const { data: entry, error: fetchError } = await supabaseAdmin
    .from("diary_entries")
    .select(`
      id,
      title,
      user_id,
      merged_video_supabase_url,
      merged_video_url,
      created_at,
      pets (
        name
      )
    `)
    .eq("id", entryId)
    .single()

  if (fetchError || !entry) {
    throw new Error("Entry not found")
  }

  let storagePath: string | null = null
  let bucket = "videos"

  if (entry.merged_video_supabase_url) {
    // Extract path from Supabase URL: https://[project].supabase.co/storage/v1/object/public/videos/path
    const urlMatch = entry.merged_video_supabase_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (urlMatch) {
      bucket = urlMatch[1]
      storagePath = urlMatch[2]
    }
  } else if (entry.merged_video_url && entry.merged_video_url.includes("supabase")) {
    // Fallback: try to extract from merged_video_url if it's a Supabase URL
    const urlMatch = entry.merged_video_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (urlMatch) {
      bucket = urlMatch[1]
      storagePath = urlMatch[2]
    }
  }

  if (!storagePath) {
    throw new Error("No downloadable video available")
  }

  // "For socials": the same tale with its title burned in (made once, then reused)
  if (variant === "social") {
    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)
    const social = await ensureSocialVersion({
      id: entry.id,
      title: entry.title,
      user_id: (entry as { user_id?: string | null }).user_id ?? null,
      created_at: entry.created_at,
      sourceUrl: pub.publicUrl,
    })
    bucket = social.bucket
    storagePath = social.path
  }

  const petName = entry.pets?.name || "Pet"
  const entryDate = new Date(entry.created_at).toISOString().split("T")[0].replace(/-/g, "")

  let filename: string
  if (proposedFilename) {
    // Sanitize proposed filename
    filename = sanitizeFilename(proposedFilename)
  } else {
    // Generate default filename: PawTale-{PetName}-{YYYYMMDD}.mp4
    filename = sanitizeFilename(`PawTale-${petName}-${entryDate}.mp4`)
  }

  const expirySeconds = Number.parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || "420", 10)

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, expirySeconds, {
      download: filename,
    })

  if (signError || !signedData) {
    console.error("Error creating signed URL:", signError)
    throw new Error("Failed to create signed download URL")
  }

  const expiresAt = new Date(Date.now() + expirySeconds * 1000)

  return {
    url: signedData.signedUrl,
    expiresAt,
    filename,
  }
}

/**
 * Sanitizes filename to safe characters and enforces length limit
 * @param filename - Raw filename to sanitize
 * @returns Sanitized filename with [A-Za-z0-9._-] characters only, max 80 chars
 */
function sanitizeFilename(filename: string): string {
  // Remove or replace unsafe characters, keep only [A-Za-z0-9._-]
  let sanitized = filename
    .replace(/[^A-Za-z0-9._-]/g, "-") // Replace unsafe chars with dash
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, "") // Remove leading/trailing dashes

  if (!sanitized || sanitized === ".mp4" || sanitized === "-") {
    const fallbackDate = new Date().toISOString().split("T")[0].replace(/-/g, "")
    sanitized = `PawTale-Video-${fallbackDate}.mp4`
  }

  // Ensure .mp4 extension
  if (!sanitized.toLowerCase().endsWith(".mp4")) {
    sanitized = sanitized.replace(/\.[^.]*$/, "") + ".mp4"
  }

  // Cap length to 80 characters
  if (sanitized.length > 80) {
    const extension = ".mp4"
    const maxNameLength = 80 - extension.length
    sanitized = sanitized.substring(0, maxNameLength) + extension
  }

  return sanitized
}
