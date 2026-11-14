import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/auth-middleware"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** GET /api/admin/upload-failures: the latest 200 failed clips, newest first, with user emails */
export const GET = requireAdmin(async () => {
  const { data, error } = await supabaseAdmin
    .from("upload_failures")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    const missing = /does not exist|schema cache/i.test(error.message)
    return NextResponse.json(
      { error: missing ? "Run the upload_failures migration in Supabase first." : error.message },
      { status: missing ? 503 : 500 },
    )
  }
  const rows = data ?? []
  const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))]
  const emails = new Map<string, string>()
  if (ids.length) {
    const { data: users } = await supabaseAdmin.from("users").select("id, email").in("id", ids)
    for (const u of users ?? []) emails.set((u as any).id, (u as any).email)
  }
  return NextResponse.json({ failures: rows.map((r: any) => ({ ...r, email: r.user_id ? emails.get(r.user_id) ?? null : null })) })
})
