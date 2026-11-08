import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { logAdminAction } from "@/lib/api/audit-logger"
import { sweepCloudinaryStorage } from "@/lib/cloudinary-storage"
import type { AdminContext } from "@/lib/api/types"

export const maxDuration = 300

/**
 * POST /api/admin/storage-cleanup
 * { apply: false } (default) shows what would be removed from Cloudinary; { apply: true } removes it.
 * Finished tales keep playing: their playback is switched to the Supabase copy before the
 * Cloudinary copy is deleted, and only when that Supabase copy is confirmed reachable.
 */
const handler = requireAdmin(async (request: Request, context: AdminContext) => {
  const body = await request.json().catch(() => ({}))
  const apply = body?.apply === true
  try {
    const plan = await sweepCloudinaryStorage(apply)
    if (apply) {
      await logAdminAction(context.userId, "cloudinary_storage_cleanup", {
        deleted: plan.deleted,
        removeBytes: plan.removeBytes,
        playbackSwitched: plan.playbackSwitched,
        errors: plan.errors?.length || 0,
      })
    }
    return NextResponse.json({ success: true, applied: apply, plan })
  } catch (error: any) {
    console.error("Storage cleanup failed:", error)
    return NextResponse.json(
      { error: error?.error?.message || error?.message || "Storage cleanup failed" },
      { status: 500 },
    )
  }
})

export const POST = handler
