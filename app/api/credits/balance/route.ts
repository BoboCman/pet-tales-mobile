import { getCreditBalance } from "@/app/actions/credits-api-actions"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await getCreditBalance()

    if (!result.ok && result.code === "AUTH_REQUIRED") {
      return NextResponse.json(result, { status: 401 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Credits balance route error:", error)
    return NextResponse.json(
      {
        ok: false,
        balance: 0,
        code: "SERVER_ERROR",
        message: "Unable to fetch credits",
      },
      { status: 500 },
    )
  }
}
