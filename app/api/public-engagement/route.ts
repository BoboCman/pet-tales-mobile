import { type NextRequest, NextResponse } from "next/server"
import { updatePublicLike } from "@/lib/supabase/public-server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, taleId, sessionId } = body

    console.log(`📊 Public engagement API called:`, { action, taleId, sessionId })

    if (!action || !taleId || !sessionId) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    if (action === "view") {
      console.log(`⚠️ View action deprecated - redirecting to unified API`)

      const response = await fetch("/api/engagement/view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward original request headers for IP/UA extraction
          "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
          "user-agent": request.headers.get("user-agent") || "",
        },
        body: JSON.stringify({
          entryId: taleId,
        }),
      })

      if (!response.ok) {
        return NextResponse.json({ success: false, error: "Failed to record view" }, { status: response.status })
      }

      return response
    }

    if (action === "like") {
      const result = await updatePublicLike(taleId, sessionId)
      console.log(`❤️ Like update result:`, result)
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("❌ Public engagement API error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
