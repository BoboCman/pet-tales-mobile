import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

/**
 * Convert a Supabase storage path to a public URL
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Extract bucket and path from a Supabase storage URL
 */
export function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split("/")

    // Supabase storage URLs have format: /storage/v1/object/public/{bucket}/{path}
    if (pathParts[1] === "storage" && pathParts[2] === "v1" && pathParts[3] === "object" && pathParts[4] === "public") {
      const bucket = pathParts[5]
      const path = pathParts.slice(6).join("/")
      return { bucket, path }
    }

    return null
  } catch (error) {
    console.error("❌ Failed to parse Supabase URL:", error)
    return null
  }
}

/**
 * Validate if a URL is a valid Supabase storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return parseSupabaseUrl(url) !== null
}

/**
 * Get file extension from URL
 */
export function getFileExtension(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const lastDot = pathname.lastIndexOf(".")
    return lastDot > 0 ? pathname.substring(lastDot + 1).toLowerCase() : ""
  } catch (error) {
    return ""
  }
}

/**
 * Generate a unique filename with timestamp
 */
export function generateUniqueFilename(prefix: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}.${extension}`
}
