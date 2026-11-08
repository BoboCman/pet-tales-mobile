import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { logAdminAction } from "@/lib/api/audit-logger"
import { deleteAccount } from "@/lib/account/delete-account"
import type { AdminContext } from "@/lib/api/types"

export const maxDuration = 60

/** Admin → Users → Delete user. Same steps as the user deleting their own account. */
export const POST = requireAdmin(async (request: Request, context: AdminContext & { params?: any }) => {
  const params = await context.params
  const userId: string | undefined = params?.id
  if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 })
  if (userId === context.userId) return NextResponse.json({ error: "You can't delete your own admin account" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 })

  const result = await deleteAccount(userId, { type: "admin", adminId: context.userId })
  await logAdminAction(context.userId, "delete_user", {
    targetUserId: userId,
    success: result.success,
    cancelledSubscriptions: result.cancelledSubscriptions,
    deletedTales: result.deletedTales,
    keptPublicTales: result.keptPublicTales,
    problems: result.problems.slice(0, 10),
  })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
})
