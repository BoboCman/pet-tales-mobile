import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWelcomeEmail } from "@/lib/email/send"

export const dynamic = "force-dynamic"

/**
 * Sends the signed-in user their welcome email. Called by the signup form right after signup.
 * Sends at most once per user (dedupe key), so calling it again does nothing.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only for new accounts: stops anyone re-triggering it for an old account
  const ageMs = Date.now() - new Date(user.created_at).getTime()
  if (ageMs > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ sent: false, skipped: "account is not new" })
  }

  const result = await sendWelcomeEmail(user.id)
  return NextResponse.json(result)
}
