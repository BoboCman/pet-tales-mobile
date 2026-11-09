import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"
import type { TaleHealth } from "@/lib/tale-health"
import { cn } from "@/lib/utils"

/** Small badge saying whether a tale finished the way it should (length vs narration). */
export function TaleHealthBadge({ health, className }: { health?: TaleHealth | null; className?: string }) {
  if (!health || health.state === "unknown") return null
  const style = {
    ok: { icon: CheckCircle2, text: "Length OK", cls: "bg-green-50 text-green-700 border-green-200" },
    too_short: { icon: AlertTriangle, text: "Ends early", cls: "bg-red-50 text-red-700 border-red-200" },
    too_long: { icon: AlertTriangle, text: "Runs long", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    failed: { icon: XCircle, text: "Failed", cls: "bg-red-50 text-red-700 border-red-200" },
    stuck: { icon: Clock, text: "Stuck", cls: "bg-amber-50 text-amber-800 border-amber-200" },
    processing: { icon: Clock, text: "Making", cls: "bg-gray-50 text-gray-600 border-gray-200" },
  }[health.state]
  const Icon = style.icon
  return (
    <span
      title={health.label}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", style.cls, className)}
    >
      <Icon className="h-3 w-3" />
      {style.text}
    </span>
  )
}
