import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteAccount } from "@/lib/account/delete-account"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Settings → Delete account. The person types DELETE to confirm. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Please sign in again" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 })
  }

  const result = await deleteAccount(user.id, { type: "self" })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  // The login is gone; clear the session cookies too
  await supabase.auth.signOut().catch(() => {})
  return NextResponse.json({ success: true, cancelledSubscriptions: result.cancelledSubscriptions })
}
