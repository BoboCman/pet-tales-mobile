"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

/** Admin > Uploads: clips the new tale screen turned away or failed to upload */

type Failure = {
  id: string
  created_at: string
  user_id: string | null
  email: string | null
  stage: string
  reason: string
  message: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  duration_seconds: number | null
  width: number | null
  height: number | null
  user_agent: string | null
  platform: string | null
}

const STAGE_LABEL: Record<string, string> = { picked: "Clip check", upload: "Upload", start: "Starting tale" }

function browserOf(ua: string | null) {
  if (!ua) return ""
  if (/CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome"
  if (/FxiOS|Firefox\//.test(ua)) return "Firefox"
  if (/Edg\//.test(ua)) return "Edge"
  if (/SamsungBrowser/.test(ua)) return "Samsung"
  if (/Safari\//.test(ua)) return "Safari"
  return "other"
}

const mb = (b: number | null) => (b == null ? "" : `${(b / (1024 * 1024)).toFixed(1)} MB`)

export default function AdminUploadsPage() {
  const [rows, setRows] = useState<Failure[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/upload-failures", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
        setRows(json.failures ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load failed uploads"))
  }, [])

  // Last 7 days, grouped by reason: shows which problems are common
  const summary = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const counts = new Map<string, number>()
    for (const r of rows ?? []) {
      if (new Date(r.created_at).getTime() < weekAgo) continue
      counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h2 className="text-2xl font-bold">Failed uploads</h2>
      <p className="mt-1 text-sm text-gray-600">
        Clips that were turned away when picked, or failed to upload or start. Tales that fail later in processing are in{" "}
        <Link href="/admin/videos" className="text-teal-700 underline">
          Videos
        </Link>
        .
      </p>

      {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!rows && !error && <p className="mt-6 text-sm text-gray-500">Loading…</p>}

      {rows && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700">Last 7 days:</span>
            {summary.length === 0 && <span className="text-sm text-gray-500">none</span>}
            {summary.map(([reason, n]) => (
              <span key={reason} className="rounded-full bg-gray-100 px-3 py-0.5 text-sm text-gray-800">
                {reason.replace(/_/g, " ")} · {n}
              </span>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Where</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                      No failed uploads yet.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {r.user_id ? (
                        <Link href={`/admin/users/${r.user_id}`} className="text-teal-700 underline">
                          {r.email ?? "user"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{STAGE_LABEL[r.stage] ?? r.stage}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{r.reason.replace(/_/g, " ")}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.platform} {browserOf(r.user_agent)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <div className="max-w-[16rem] truncate" title={r.file_name ?? ""}>
                        {r.file_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {[r.file_type || "no type", mb(r.file_size), r.duration_seconds != null ? `${Math.round(r.duration_seconds)}s` : "", r.width && r.height ? `${r.width}×${r.height}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      <div className="max-w-[20rem] break-words">{r.message}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
