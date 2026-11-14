import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** Records a failed clip from the new tale screen (shown in Admin > Uploads) */

const str = (v: unknown, max: number) => (typeof v === "string" && v.length ? v.slice(0, max) : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const STAGES = new Set(["picked", "upload", "start"])

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const stage = str(body.stage, 20)
    const reason = str(body.reason, 40)
    if (!stage || !STAGES.has(stage) || !reason) return NextResponse.json({ ok: false }, { status: 400 })

    // Keep one person from flooding the log: at most 30 reports an hour
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabaseAdmin
      .from("upload_failures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
    if ((count ?? 0) >= 30) return NextResponse.json({ ok: true, skipped: true })

    const width = num(body.width)
    const height = num(body.height)
    const { error } = await supabaseAdmin.from("upload_failures").insert({
      user_id: user.id,
      stage,
      reason,
      message: str(body.message, 500),
      file_name: str(body.file_name, 200),
      file_type: str(body.file_type, 100),
      file_size: num(body.file_size),
      duration_seconds: num(body.duration_seconds),
      width: width === null ? null : Math.round(width),
      height: height === null ? null : Math.round(height),
      user_agent: str(body.user_agent, 400),
      platform: str(body.platform, 20),
    })
    if (error) {
      console.error("[upload-failure] insert failed:", error.message)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[upload-failure] error:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
