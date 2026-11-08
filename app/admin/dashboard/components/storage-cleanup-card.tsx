"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { HardDrive, Loader2, Trash2 } from "lucide-react"

type Bucket = { count: number; bytes: number }
type Plan = {
  scannedAssets: number
  scannedBytes: number
  remove: Record<string, Bucket>
  keep: { count: number; bytes: number; reasons: Record<string, number> }
  removeBytes: number
  deleted?: number
  playbackSwitched?: number
  errors?: string[]
}

const LABELS: Record<string, string> = {
  finished_tale: "Finished tales (already safe in Supabase)",
  working_file_finished: "Working files of finished tales",
  working_file_failed: "Working files of tales that failed over 2 weeks ago",
  deleted_tale: "Files of tales that were deleted",
  leftover: "Leftover intermediate files",
}

function gb(bytes: number) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function StorageCleanupCard() {
  const { toast } = useToast()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null)
  const [done, setDone] = useState<Plan | null>(null)

  async function run(apply: boolean) {
    setBusy(apply ? "apply" : "preview")
    try {
      const res = await fetch("/api/admin/storage-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Request failed")
      if (apply) {
        setDone(data.plan)
        setPlan(null)
        toast({ title: "Cleanup finished", description: `${data.plan.deleted} files removed from Cloudinary` })
      } else {
        setPlan(data.plan)
        setDone(null)
      }
    } catch (e) {
      toast({ title: "Cleanup failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Cloudinary storage cleanup
        </CardTitle>
        <CardDescription>
          Cloudinary charges 1 credit per GB stored, every month. This removes files that are no longer needed.
          Finished tales keep playing from Supabase. Preview first; nothing is deleted until you confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={() => run(false)} disabled={busy !== null}>
          {busy === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Preview cleanup
        </Button>

        {plan && (
          <div className="space-y-3 text-sm">
            <p>
              Cloudinary holds {plan.scannedAssets} files ({gb(plan.scannedBytes)}) for tales. This would remove{" "}
              <strong>{gb(plan.removeBytes)}</strong>, saving about{" "}
              <strong>{Math.max(0, plan.removeBytes / 1024 ** 3).toFixed(1)} credits a month</strong>.
            </p>
            <ul className="space-y-1">
              {Object.entries(plan.remove)
                .filter(([, b]) => b.count > 0)
                .map(([key, b]) => (
                  <li key={key}>
                    {LABELS[key] || key}: {b.count} files, {gb(b.bytes)}
                  </li>
                ))}
            </ul>
            <p className="text-gray-600 dark:text-gray-400">
              Keeping {plan.keep.count} files ({gb(plan.keep.bytes)}):{" "}
              {Object.entries(plan.keep.reasons)
                .map(([reason, n]) => `${n} ${reason}`)
                .join("; ") || "none"}
            </p>
            <Button variant="destructive" onClick={() => run(true)} disabled={busy !== null || plan.removeBytes === 0}>
              {busy === "apply" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete {gb(plan.removeBytes)} from Cloudinary
            </Button>
          </div>
        )}

        {done && (
          <div className="text-sm space-y-1">
            <p>
              Removed {done.deleted} files ({gb(done.removeBytes)}). {done.playbackSwitched} finished tales now play from
              Supabase.
            </p>
            {done.errors && done.errors.length > 0 && (
              <p className="text-red-600">Problems: {done.errors.join("; ")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
