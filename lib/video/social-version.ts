import { createHash } from "crypto"
import { v2 as cloudinary } from "cloudinary"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { shouldWatermark } from "@/lib/video/watermark"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * "For socials" copy of a finished tale: the tale's title burned into the top, plus the small
 * pettaleai.com line (free tales already have the mark, so it isn't added twice). The tale page shows the
 * title as page text, so a plain download loses it; this copy keeps it when posted to TikTok,
 * Reels or used in an ad.
 *
 * Made once per title and kept in the videos bucket (videos/social/...). Cloudinary only renders it:
 * the temporary asset is deleted right after.
 */

const BUCKET = "videos"

/** Arial can't draw emoji, and Cloudinary text layers trip on some symbols */
export function overlayTitle(title: string | null | undefined): string {
  const clean = (title || "")
    .replace(/[^\p{L}\p{N}\s'’!?.&:,\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
  return clean.slice(0, 70) || "A Pet Tale"
}

/** Bump when the look changes, so already-made copies are rendered again in the new style */
const STYLE_VERSION = "v3"

function socialPath(entryId: string, title: string) {
  const v = createHash("sha1").update(`${STYLE_VERSION}:${title}`).digest("hex").slice(0, 8)
  return { folder: "social", name: `pet-tale-${entryId}-${v}.mp4` }
}

async function fetchRendered(url: string): Promise<Buffer> {
  // Cloudinary renders on first request; big jobs answer 420/423 until they're done
  const waits = [0, 5000, 10000, 15000, 20000, 25000]
  let last = ""
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    const res = await fetch(url)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    last = `${res.status} ${res.headers.get("x-cld-error") ?? ""}`.trim()
    if (![420, 423, 502, 503, 504].includes(res.status)) break
  }
  throw new Error(`Social render failed: ${last}`)
}

/** Returns the storage path of the social copy, making it first if needed. */
export async function ensureSocialVersion(entry: {
  id: string
  title: string | null
  user_id: string | null
  created_at: string | null
  sourceUrl: string
}): Promise<{ bucket: string; path: string }> {
  const title = overlayTitle(entry.title)
  const { folder, name } = socialPath(entry.id, title)
  const path = `${folder}/${name}`

  const { data: existing } = await supabaseAdmin.storage.from(BUCKET).list(folder, { search: name, limit: 1 })
  if (existing?.some((f) => f.name === name)) return { bucket: BUCKET, path }

  const publicId = `social-tmp/pet-tale-${entry.id}`
  const upload = await cloudinary.uploader.upload(entry.sourceUrl, {
    resource_type: "video",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
  })

  try {
    const width = upload.width || 720
    const height = upload.height || 1280
    const scale = width / 720
    const watermarked = await shouldWatermark(entry.user_id, entry.created_at)

    // Modern caption look: Poppins (a Google Font Cloudinary loads by name), bare white text with a soft
    // shadow so nothing covers the video. The shadow is a blurred, see-through black copy of the same text
    // laid underneath; if Cloudinary refuses the blur, a thin outline keeps the text readable instead.
    type Look = "shadow" | "outline"
    const build = (font: string, look: Look) => {
      const transformation: Record<string, unknown>[] = []
      const text = (value: string, size: number, y: number | string, wrap: boolean) => {
        const base = {
          font_family: font,
          font_size: Math.round(size * scale),
          font_weight: "bold",
          text_align: "center",
          line_spacing: Math.round(-4 * scale),
          text: value,
          ...(look === "outline" ? { stroke: "stroke" } : {}),
        }
        const fit = wrap ? { width: Math.round(width * 0.84), crop: "fit" } : {}
        if (look === "shadow") {
          transformation.push(
            { overlay: base, color: "black", opacity: 55, effect: `blur:${Math.round(120 * scale)}`, ...fit },
            { flags: "layer_apply", gravity: "north", y: typeof y === "number" ? y + Math.round(3 * scale) : y },
          )
          transformation.push({ overlay: base, color: "white", ...fit }, { flags: "layer_apply", gravity: "north", y })
        } else {
          transformation.push(
            {
              overlay: base,
              color: "white",
              border: `${Math.max(2, Math.round(3 * scale))}px_solid_rgb:000000b3`,
              ...fit,
            },
            { flags: "layer_apply", gravity: "north", y },
          )
        }
      }

      text(title, 50, Math.round(height * 0.07), true)
      // Small brand line under the title, where the free-tale mark sits
      if (!watermarked) text("pettaleai.com", 26, Math.round(height * 0.19), false)

      transformation.push({
        video_codec: "h264",
        audio_codec: "aac",
        quality: "auto:good",
      })

      return cloudinary.url(publicId, {
        resource_type: "video",
        format: "mp4",
        secure: true,
        transformation,
      })
    }

    // Best look first; if Cloudinary can't do it (font or effect), a simpler copy beats no copy
    const attempts: [string, Look][] = [
      ["Poppins", "shadow"],
      ["Poppins", "outline"],
      ["Arial", "outline"],
    ]
    let video: Buffer | null = null
    let lastError: unknown
    for (const [font, look] of attempts) {
      try {
        video = await fetchRendered(build(font, look))
        break
      } catch (error) {
        lastError = error
        console.warn(`[social-version] ${font}/${look} render failed:`, error)
      }
    }
    if (!video) throw lastError

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, video, {
      contentType: "video/mp4",
      upsert: true,
      cacheControl: "31536000",
    })
    if (error) throw new Error(`Saving the social copy failed: ${error.message}`)
    return { bucket: BUCKET, path }
  } finally {
    // Only Supabase keeps the result; free the Cloudinary storage
    await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true }).catch(() => {})
  }
}
