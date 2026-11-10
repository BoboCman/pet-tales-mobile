import { Coins } from "lucide-react"
import { formatCredits, formatDollars, type TaleCost } from "@/lib/tale-cost"
import { cn } from "@/lib/utils"

/** Small badge with a tale's Cloudinary cost: credits and dollars on the Plus plan. */
export function TaleCostBadge({ cost, className }: { cost?: TaleCost | null; className?: string }) {
  if (!cost) return null
  return (
    <span
      title={`${Math.round(cost.videoSeconds)}s of 720p video processed${cost.runs > 1 ? ` over ${cost.runs} runs` : ""}${
        cost.complete ? "" : " (some lengths missing, so this is a minimum)"
      }`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700",
        className,
      )}
    >
      <Coins className="h-3 w-3" />
      {formatCredits(cost.credits)} cr · {formatDollars(cost.dollars)}
      {!cost.complete && "+"}
    </span>
  )
}
