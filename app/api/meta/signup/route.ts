import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { metaContextFromRequest, metaServerEnabled, sendMetaEvent, trackingAllowed } from "@/lib/meta/capi"

export const dynamic = "force-dynamic"

/**
 * Server copy of the signup event for Meta (CompleteRegistration). Called by the signup form right
 * after signup with the same event id the browser pixel used, so Meta counts one signup.
 */
export async function POST(request: Request) {
  if (!metaServerEnabled() || !trackingAllowed(request)) return NextResponse.json({ sent: false })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only for brand-new accounts, so it can't be replayed for an old one
  if (Date.now() - new Date(user.created_at).getTime() > 60 * 60 * 1000) {
    return NextResponse.json({ sent: false, skipped: "account is not new" })
  }

  await sendMetaEvent({
    name: "CompleteRegistration",
    eventId: `signup-${user.id}`,
    context: metaContextFromRequest(request),
    email: user.email,
    userId: user.id,
  })
  return NextResponse.json({ sent: true })
}
