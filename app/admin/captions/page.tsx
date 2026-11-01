import type { Metadata } from "next"
import CaptionDebug from "@/components/admin/caption-debug"

export const metadata: Metadata = {
  title: "Caption Debug - Admin",
  description: "Debug and monitor caption generation for diary entries",
}

export default function CaptionDebugPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CaptionDebug />
    </div>
  )
}
