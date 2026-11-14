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

    // Only the tale's owner can download it (admins too, for support)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    }
    const [{ data: entry }, { data: me }] = await Promise.all([
      supabaseAdmin.from("diary_entries").select("user_id").eq("id", entryId).maybeSingle(),
      supabaseAdmin.from("users").select("is_admin").eq("id", user.id).maybeSingle(),
    ])
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
