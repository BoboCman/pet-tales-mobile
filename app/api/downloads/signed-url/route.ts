import { type NextRequest, NextResponse } from "next/server"
import { getSignedDownloadUrl } from "@/lib/storage/getSignedDownloadUrl"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { hasAdminMfa } from "@/lib/admin/mfa"

// The first "For socials" download renders the titled copy, which can take a little while
export const maxDuration = 120

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PATCH() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entryId, filename } = body
    const variant = body.variant === "social" ? "social" : "original"

    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid entryId" },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      )
    }

    // The clean original: only the tale's owner (admins too, for support).
    // The "for socials" copy (title + pettaleai.com burned in) of a PUBLIC tale: anyone, signed in
    // or not, since the tale is public anyway and every saved copy points back to Pet Tale.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: entry } = await supabaseAdmin
      .from("diary_entries")
      .select("user_id, is_public, billing_status")
      .eq("id", entryId)
      .maybeSingle()
    const publicSocial =
      variant === "social" && entry?.is_public === true && entry.billing_status !== "billing_required"

    if (!publicSocial) {
      if (!user) {
        return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "no-store" } })
      }
      const { data: me } = await supabaseAdmin.from("users").select("is_admin").eq("id", user.id).maybeSingle()
      // An admin can fetch someone else's tale only from a session that passed the authenticator code
      let adminWithMfa = false
      if (me?.is_admin && entry && entry.user_id !== user.id) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        adminWithMfa = hasAdminMfa(session?.access_token)
      }
      if (!entry || (entry.user_id !== user.id && !adminWithMfa)) {
        return NextResponse.json({ error: "Tale not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
      }
    }

    const result = await getSignedDownloadUrl(
      entryId,
      variant === "social" && typeof filename === "string" ? `${filename.replace(/\.mp4$/i, "")}-social` : filename,
      variant,
    )

    console.log("📥 Download requested:", {
      entryId,
      filename: result.filename,
      expiresAt: result.expiresAt.toISOString(),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
        filename: result.filename,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    )
  } catch (error: any) {
    console.error("❌ Error in signed-url route:", error)

    if (error.message === "Entry not found") {
      return NextResponse.json(
        { error: "Tale not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      )
    }

    if (error.message === "No downloadable video available") {
      return NextResponse.json(
        { error: "No downloadable video available" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      )
    }

    // Generic server error
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    )
  }
}
