import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { logAdminAction } from "@/lib/api/audit-logger"
import { internalAuthHeaders } from "@/lib/api/internal-auth"
import { getAppBaseUrl } from "@/lib/utils/app-url"
import type { AdminContext } from "@/lib/api/types"

// The merge itself can take a few minutes
export const maxDuration = 300

/**
 * POST /api/admin/videos/[id]/retry-merge
 * Re-runs the final step (narration + captions onto the 720p copy) for a tale that failed or got stuck.
 * With { rebuild: true }, or for a tale that already finished, redoes it from the original upload.
 * The user's tale is not charged again.
 */
const handler = requireAdmin(async (_request: Request, context: AdminContext & { params?: any }) => {
  const params = await context.params
  const entryId: string | undefined = params?.id
  if (!entryId) return NextResponse.json({ error: "Missing tale id" }, { status: 400 })

  const body = await _request.json().catch(() => ({}))
  const rebuild = body?.rebuild === true

  const { data: entry } = await supabaseAdmin
    .from("diary_entries")
    .select("id, title, user_id, video_url, compression_status, optimized_video_url, voiceover_url, merged_video_status")
    .eq("id", entryId)
    .maybeSingle()
  if (!entry) return NextResponse.json({ error: "Tale not found" }, { status: 404 })

  // A finished tale's working files (720p copy, narration upload, captions) are deleted after
  // the merge, so redoing it starts again from the original upload. Takes a few minutes.
  if (rebuild || entry.merged_video_status === "completed") {
    if (!entry.video_url || !entry.voiceover_url) {
      return NextResponse.json({ error: "The original video or narration is missing" }, { status: 409 })
    }
    const { error: resetError } = await supabaseAdmin
      .from("diary_entries")
      .update({
        merged_video_status: null,
        merged_video_error: null,
        merged_processing_started_at: null,
        optimized_video_url: null,
        compression_status: "pending",
        compression_error: null,
        cloudinary_audio_public_id: null,
      })
      .eq("id", entryId)
    if (resetError) return NextResponse.json({ error: "Could not reset the tale" }, { status: 500 })

    await logAdminAction(context.userId, "rebuild_tale", { entryId, previousStatus: entry.merged_video_status })

    const res = await fetch(`${getAppBaseUrl()}/api/video/compress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
      body: JSON.stringify({ entryId, videoUrl: entry.video_url }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data.error || "Could not restart the tale" }, { status: 502 })
    // The compression webhook starts the merge when the 720p copy is ready
    return NextResponse.json({ success: true, rebuilding: true })
  }
  if (entry.compression_status !== "completed" || !entry.optimized_video_url) {
    return NextResponse.json(
      { error: "The video is still being compressed. Try again in a few minutes." },
      { status: 409 },
    )
  }
  if (!entry.voiceover_url) {
    return NextResponse.json({ error: "This tale has no narration yet, so it can't be finished" }, { status: 409 })
  }

  await logAdminAction(context.userId, "retry_merge", { entryId, previousStatus: entry.merged_video_status })

  const res = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
    body: JSON.stringify({ entryId }),
  })
  const data = await res.json().catch(() => ({}))

  if (res.status === 409) {
    return NextResponse.json({ error: data.reason || "Already running" }, { status: 409 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: data.error || "Retry failed" }, { status: 502 })
  }
  return NextResponse.json({ success: true })
})

export const POST = handler
