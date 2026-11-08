import { v2 as cloudinary } from "cloudinary"
import { supabaseAdmin } from "@/lib/supabase/admin"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Cloudinary storage is billed every month (1 credit per GB held), so nothing should stay there
 * once a tale is finished: the finished tale lives in Supabase (videos/merged-videos/), and the
 * working files (original/720p copy, narration, captions) are only needed while it is being made.
 */

/** True when the Supabase copy can actually be played by anyone (public bucket, file present). */
export async function isPubliclyReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" })
    if (res.ok) return true
    // Some storage setups refuse HEAD; ask for the first byte instead
    if (res.status === 405 || res.status === 400) {
      const ranged = await fetch(url, { headers: { Range: "bytes=0-0" }, cache: "no-store" })
      return ranged.ok || ranged.status === 206
    }
    return false
  } catch {
    return false
  }
}

/**
 * Point playback at the Supabase copy, then delete the finished tale from Cloudinary.
 * Does nothing (and keeps Cloudinary) unless the Supabase copy is reachable.
 */
export async function moveFinishedTaleOffCloudinary(
  entryId: string,
  supabaseUrl: string,
  cloudinaryPublicId: string | null | undefined,
): Promise<{ moved: boolean; reason?: string }> {
  if (!(await isPubliclyReachable(supabaseUrl))) {
    return { moved: false, reason: "Supabase copy is not reachable; keeping the Cloudinary copy" }
  }

  const { error } = await supabaseAdmin
    .from("diary_entries")
    .update({ merged_video_url: supabaseUrl, merged_video_supabase_url: supabaseUrl })
    .eq("id", entryId)
  if (error) return { moved: false, reason: `Could not switch playback: ${error.message}` }

  if (cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: "video", invalidate: true })
    } catch (destroyError) {
      // Playback already uses Supabase; the storage sweep will pick this one up later
      console.warn("Could not delete finished tale from Cloudinary:", cloudinaryPublicId, destroyError)
    }
  }
  return { moved: true }
}

// ---------------------------------------------------------------------------------------------
// Storage sweep (admin): find everything in pawsense/ that is no longer needed.
// ---------------------------------------------------------------------------------------------

type ResourceType = "video" | "raw" | "image"

type Asset = { public_id: string; resource_type: ResourceType; bytes: number; created_at: string }

export type SweepCategory =
  | "finished_tale" // final video, Supabase copy confirmed
  | "working_file_finished" // original/720p copy, narration or captions of a finished tale
  | "working_file_failed" // working files of a tale that failed more than FAILED_GRACE_DAYS ago
  | "deleted_tale" // tale no longer exists
  | "leftover" // intermediate files that are never needed after a run

export type SweepPlan = {
  scannedAssets: number
  scannedBytes: number
  remove: Record<SweepCategory, { count: number; bytes: number }>
  keep: { count: number; bytes: number; reasons: Record<string, number> }
  removeBytes: number
  /** Only filled when applying */
  deleted?: number
  playbackSwitched?: number
  errors?: string[]
}

const PREFIX = "pawsense/"
const FAILED_GRACE_DAYS = 14
const ENTRY_ID_RE = /entry_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

async function listAssets(resourceType: ResourceType): Promise<Asset[]> {
  const out: Asset[] = []
  let next_cursor: string | undefined
  do {
    const page: any = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix: PREFIX,
      max_results: 500,
      next_cursor,
    })
    for (const r of page.resources || []) {
      out.push({ public_id: r.public_id, resource_type: resourceType, bytes: r.bytes || 0, created_at: r.created_at })
    }
    next_cursor = page.next_cursor
  } while (next_cursor)
  return out
}

type EntryRow = {
  id: string
  created_at: string
  merged_video_status: string | null
  merged_video_url: string | null
  merged_video_supabase_url: string | null
}

async function loadEntries(ids: string[]): Promise<Map<string, EntryRow>> {
  const map = new Map<string, EntryRow>()
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { data, error } = await supabaseAdmin
      .from("diary_entries")
      .select("id, created_at, merged_video_status, merged_video_url, merged_video_supabase_url")
      .in("id", chunk)
    if (error) throw new Error(`Could not read tales: ${error.message}`)
    for (const row of (data || []) as EntryRow[]) map.set(row.id, row)
  }
  return map
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++
        results[i] = await fn(items[i])
      }
    }),
  )
  return results
}

/**
 * Work out what can go. With apply=true it also switches playback to Supabase for finished tales
 * and deletes. Anything it cannot tie to a tale (outside the known file names) is kept.
 */
export async function sweepCloudinaryStorage(apply: boolean): Promise<SweepPlan> {
  const assets = [...(await listAssets("video")), ...(await listAssets("raw")), ...(await listAssets("image"))]

  const ids = Array.from(new Set(assets.map((a) => a.public_id.match(ENTRY_ID_RE)?.[1]).filter(Boolean) as string[]))
  const entries = await loadEntries(ids)

  // Which finished tales have a Supabase copy that really plays
  const finished = Array.from(entries.values()).filter(
    (e) => e.merged_video_status === "completed" && e.merged_video_supabase_url,
  )
  const reachable = new Set<string>()
  await mapLimit(finished, 10, async (e) => {
    if (await isPubliclyReachable(e.merged_video_supabase_url!)) reachable.add(e.id)
  })

  const plan: SweepPlan = {
    scannedAssets: assets.length,
    scannedBytes: assets.reduce((s, a) => s + a.bytes, 0),
    remove: {
      finished_tale: { count: 0, bytes: 0 },
      working_file_finished: { count: 0, bytes: 0 },
      working_file_failed: { count: 0, bytes: 0 },
      deleted_tale: { count: 0, bytes: 0 },
      leftover: { count: 0, bytes: 0 },
    },
    keep: { count: 0, bytes: 0, reasons: {} },
    removeBytes: 0,
  }

  const toDelete: Asset[] = []
  const switchPlayback = new Map<string, string>()
  const keep = (a: Asset, reason: string) => {
    plan.keep.count++
    plan.keep.bytes += a.bytes
    plan.keep.reasons[reason] = (plan.keep.reasons[reason] || 0) + 1
  }
  const remove = (a: Asset, category: SweepCategory) => {
    plan.remove[category].count++
    plan.remove[category].bytes += a.bytes
    plan.removeBytes += a.bytes
    toDelete.push(a)
  }
  const graceCutoff = Date.now() - FAILED_GRACE_DAYS * 24 * 60 * 60 * 1000

  for (const a of assets) {
    const entryId = a.public_id.match(ENTRY_ID_RE)?.[1]
    if (!entryId) {
      keep(a, "not tied to a tale")
      continue
    }
    if (a.public_id.startsWith(`${PREFIX}intermediate/`)) {
      remove(a, "leftover")
      continue
    }
    const entry = entries.get(entryId)
    if (!entry) {
      remove(a, "deleted_tale")
      continue
    }
    const isFinal = a.public_id.startsWith(`${PREFIX}merged/`)
    if (entry.merged_video_status === "completed") {
      if (!reachable.has(entry.id)) {
        keep(a, "finished, but its Supabase copy isn't confirmed")
        continue
      }
      if (isFinal) {
        remove(a, "finished_tale")
        if (entry.merged_video_url !== entry.merged_video_supabase_url) {
          switchPlayback.set(entry.id, entry.merged_video_supabase_url!)
        }
      } else {
        remove(a, "working_file_finished")
      }
      continue
    }
    if (entry.merged_video_status === "failed" && new Date(entry.created_at).getTime() < graceCutoff) {
      // Redo tale starts again from the original upload in Supabase, so these are not needed
      remove(a, "working_file_failed")
      continue
    }
    keep(a, "tale still in progress or failed recently")
  }

  if (!apply) return plan

  plan.deleted = 0
  plan.playbackSwitched = 0
  plan.errors = []

  // Playback first, so no tale ever points at a file that is gone
  for (const [entryId, url] of switchPlayback) {
    const { error } = await supabaseAdmin
      .from("diary_entries")
      .update({ merged_video_url: url })
      .eq("id", entryId)
    if (error) {
      plan.errors.push(`${entryId}: could not switch playback (${error.message})`)
      // Do not delete its final video
      for (let i = toDelete.length - 1; i >= 0; i--) {
        if (toDelete[i].public_id === `${PREFIX}merged/entry_${entryId}_final`) toDelete.splice(i, 1)
      }
    } else {
      plan.playbackSwitched++
    }
  }

  // delete_resources takes up to 100 ids per call, per resource type
  for (const type of ["video", "raw", "image"] as const) {
    const batch = toDelete.filter((a) => a.resource_type === type).map((a) => a.public_id)
    for (let i = 0; i < batch.length; i += 100) {
      const ids100 = batch.slice(i, i + 100)
      try {
        const res: any = await cloudinary.api.delete_resources(ids100, { resource_type: type, invalidate: true })
        for (const status of Object.values(res.deleted || {})) {
          if (status === "deleted") plan.deleted++
        }
      } catch (e: any) {
        plan.errors.push(`${type} batch ${i / 100 + 1}: ${e?.error?.message || e?.message || "delete failed"}`)
      }
    }
  }
  return plan
}
