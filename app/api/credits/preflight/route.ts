import { type NextRequest, NextResponse } from "next/server"
import { preflightBalanceCheck } from "@/app/actions/credit-actions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const result = await preflightBalanceCheck()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[API] Credits preflight error:", error)
    return NextResponse.json(
      {
        ok: false,
        hasCredits: false,
        balance: 0,
        code: "SERVER_ERROR",
        message: "Unable to check credits",
      },
      { status: 500 },
    )
  }
}
