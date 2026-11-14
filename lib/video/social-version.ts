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
 * pettaleai.com mark (free tales already have it, so it isn't added twice). The tale page shows the
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
const STYLE_VERSION = "v2"

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

    // Modern caption-card look: Poppins (a Google Font Cloudinary loads by name), white on a soft
    // see-through dark card with rounded corners. The card's padding is a border in the same colour.
    const card = "rgb:0000006b" // black at ~42%
    const pill = "rgb:00000059" // black at ~35%
    const build = (font: string) => {
      const transformation: Record<string, unknown>[] = [
        {
          overlay: {
            font_family: font,
            font_size: Math.round(46 * scale),
            font_weight: "bold",
            text_align: "center",
            line_spacing: Math.round(-4 * scale),
            text: title,
          },
          color: "white",
          background: card,
          border: `${Math.round(18 * scale)}px_solid_${card}`,
          radius: Math.round(30 * scale),
          width: Math.round(width * 0.8),
          crop: "fit",
        },
        {
          flags: "layer_apply",
          gravity: "north",
          y: Math.round(height * 0.07),
        },
      ]
      if (!watermarked) {
        // Small brand pill under the title, where the free-tale mark sits
        transformation.push(
          {
            overlay: {
              font_family: font,
              font_size: Math.round(26 * scale),
              font_weight: "bold",
              text: "pettaleai.com",
            },
            color: "white",
            background: pill,
            border: `${Math.round(10 * scale)}px_solid_${pill}`,
            radius: Math.round(24 * scale),
          },
          { flags: "layer_apply", gravity: "north", y: 0.19 },
        )
      }
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

    // If the Google Font can't be loaded for some reason, a plain Arial copy beats no copy
    let video: Buffer
    try {
      video = await fetchRendered(build("Poppins"))
    } catch (error) {
      console.warn("[social-version] Poppins render failed, retrying with Arial:", error)
      video = await fetchRendered(build("Arial"))
    }

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
