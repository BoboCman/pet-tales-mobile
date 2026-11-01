import { type NextRequest, NextResponse } from "next/server"
import { checkUploadRateLimit } from "@/app/actions/rate-limit-actions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const result = await checkUploadRateLimit()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Rate limit check error:", error)
    return NextResponse.json(
      {
        ok: false,
        allowed: false,
        code: "SERVER_ERROR",
        message: "Unable to check rate limit",
      },
      { status: 500 },
    )
  }
}
