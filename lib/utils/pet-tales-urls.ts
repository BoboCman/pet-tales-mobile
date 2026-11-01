/**
 * Pet Tales AI URL Utility Functions
 *
 * This utility provides functions to convert Supabase video URLs to Pet Tales AI branded URLs
 * for professional video sharing and branding purposes.
 */

import { getAppBaseUrl } from "@/lib/utils/app-url"

/**
 * Extract entry ID (UUID) from Supabase video URLs
 *
 * @param supabaseUrl - The Supabase storage URL containing pet-tale-{UUID}.mp4 pattern
 * @returns The UUID string if found, null if not found or invalid
 *
 * @example
 * extractEntryIdFromVideoUrl('https://supabase.co/storage/v1/object/public/videos/merged-videos/pet-tale-123e4567-e89b-12d3-a456-426614174000.mp4')
 * // Returns: '123e4567-e89b-12d3-a456-426614174000'
 */
export function extractEntryIdFromVideoUrl(supabaseUrl: string): string | null {
  try {
    // UUID regex pattern for validation
    const uuidRegex = /pet-tale-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.mp4/i

    const match = supabaseUrl.match(uuidRegex)

    if (match && match[1]) {
      const uuid = match[1]
      console.log(`✅ Extracted UUID from video URL: ${uuid}`)
      return uuid
    }

    console.warn(`⚠️ No UUID found in video URL: ${supabaseUrl}`)
    return null
  } catch (error) {
    console.error("❌ Error extracting entry ID from video URL:", error)
    return null
  }
}

/**
 * Convert Supabase storage URL to Pet Tales AI branded URL
 *
 * @param supabaseVideoUrl - The original Supabase storage video URL
 * @returns Pet Tales AI branded URL if conversion successful, null if failed
 *
 * @example
 * createPetTalesVideoUrl('https://supabase.co/storage/v1/object/public/videos/merged-videos/pet-tale-123e4567-e89b-12d3-a456-426614174000.mp4')
 * // Returns: 'https://www.pettaleai.com/video/123e4567-e89b-12d3-a456-426614174000.mp4'
 */
export function createPetTalesVideoUrl(supabaseVideoUrl: string): string | null {
  try {
    // Extract UUID from Supabase URL
    const uuid = extractEntryIdFromVideoUrl(supabaseVideoUrl)

    if (!uuid) {
      console.warn(`⚠️ Cannot create Pet Tales AI URL - no UUID found in: ${supabaseVideoUrl}`)
      return null
    }

    // Construct Pet Tales AI branded URL
    const baseUrl = getAppBaseUrl("https://www.pettaleai.com")
    const petTalesUrl = `${baseUrl}/video/${uuid}.mp4`

    console.log(`✅ Created Pet Tales AI video URL: ${petTalesUrl}`)
    return petTalesUrl
  } catch (error) {
    console.error("❌ Error creating Pet Tales AI video URL:", error)
    return null
  }
}

/**
 * Safe wrapper function for video sharing that never fails
 *
 * @param supabaseVideoUrl - The original Supabase storage video URL
 * @returns Pet Tales AI branded URL if conversion successful, otherwise original Supabase URL
 *
 * @example
 * getPetTalesShareUrl('https://supabase.co/storage/v1/object/public/videos/merged-videos/pet-tale-123e4567-e89b-12d3-a456-426614174000.mp4')
 * // Returns Pet Tales AI URL or falls back to original URL
 */
export function getPetTalesShareUrl(supabaseVideoUrl: string): string {
  try {
    // Attempt to convert to Pet Tales AI URL
    const petTalesUrl = createPetTalesVideoUrl(supabaseVideoUrl)

    if (petTalesUrl) {
      console.log(`✅ Using Pet Tales AI share URL: ${petTalesUrl}`)
      return petTalesUrl
    }

    // Fallback to original Supabase URL
    console.log(`⚠️ Fallback to original Supabase URL: ${supabaseVideoUrl}`)
    return supabaseVideoUrl
  } catch (error) {
    console.error("❌ Error in getPetTalesShareUrl, using fallback:", error)
    return supabaseVideoUrl
  }
}

/**
 * Create Pet Tales AI video URL directly from entry ID
 *
 * @param entryId - The diary entry UUID
 * @returns Pet Tales AI branded video URL
 *
 * @example
 * createShortVideoUrl('123e4567-e89b-12d3-a456-426614174000')
 * // Returns: 'https://www.pettaleai.com/video/123e4567-e89b-12d3-a456-426614174000.mp4'
 */
export function createShortVideoUrl(entryId: string): string {
  try {
    const baseUrl = getAppBaseUrl("https://www.pettaleai.com")
    const shortUrl = `${baseUrl}/video/${entryId}.mp4`

    console.log(`✅ Created short Pet Tales AI URL: ${shortUrl}`)
    return shortUrl
  } catch (error) {
    console.error("❌ Error creating short video URL:", error)
    // Return fallback URL even on error
    return `https://www.pettaleai.com/video/${entryId}.mp4`
  }
}

/**
 * Check if URL is already a Pet Tales AI video URL
 *
 * @param url - The URL to check
 * @returns true if URL is already a Pet Tales AI video URL, false otherwise
 *
 * @example
 * isPetTalesVideoUrl('https://www.pettaleai.com/video/123e4567-e89b-12d3-a456-426614174000.mp4')
 * // Returns: true
 */
export function isPetTalesVideoUrl(url: string): boolean {
  try {
    const baseUrl = getAppBaseUrl("https://www.pettaleai.com")

    // Check if URL starts with Pet Tales AI domain and ends with .mp4
    const isPetTalesUrl = url.startsWith(`${baseUrl}/video/`) && url.endsWith(".mp4")

    if (isPetTalesUrl) {
      console.log(`✅ URL is already Pet Tales AI format: ${url}`)
    }

    return isPetTalesUrl
  } catch (error) {
    console.error("❌ Error checking if Pet Tales AI URL:", error)
    return false
  }
}

/**
 * Type definitions for Pet Tales AI URL utilities
 */
export type PetTalesUrlResult = string | null
export type PetTalesShareResult = string

/**
 * Constants for Pet Tales AI URL utilities
 */
export const PET_TALES_CONSTANTS = {
  DEFAULT_DOMAIN: "https://www.pettaleai.com",
  VIDEO_PATH: "/video/",
  VIDEO_EXTENSION: ".mp4",
  UUID_PATTERN: /pet-tale-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.mp4/i,
} as const
