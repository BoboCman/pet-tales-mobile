import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const MAX_BYTES = 1_000_000

/**
 * Save a poster frame for a finished tale that has none (tales made before posters existed).
 * The browser grabs a frame from the video it is already playing and sends it here as a JPEG.
 * Only the tale's owner can set it, and an existing poster is never replaced.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

  const { data: entry } = await supabaseAdmin
    .from("diary_entries")
    .select("id, user_id, merged_video_status")
    .eq("id", id)
    .maybeSingle()
  if (!entry || entry.user_id !== user.id || entry.merged_video_status !== "completed") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const bytes = new Uint8Array(await request.arrayBuffer())
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (!isJpeg || bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Expected a JPEG under 1 MB" }, { status: 400 })
  }

  const path = `thumbnails/pet-tale-${id}.jpg`
  const { error } = await supabaseAdmin.storage
    .from("videos")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false })
  if (error && !/exists|duplicate/i.test(error.message)) {
    console.error("Poster save failed:", error.message)
    return NextResponse.json({ error: "Could not save poster" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, existed: !!error })
}
