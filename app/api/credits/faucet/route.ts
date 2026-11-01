import { NextResponse } from "next/server"

export async function POST() {
  // For Phase 3A-5, this is a stub that returns 404/501
  // Will be implemented in Phase 3A-6
  return NextResponse.json(
    {
      ok: false,
      code: "NOT_IMPLEMENTED",
      message: "Daily faucet is coming soon.",
    },
    { status: 501 },
  )
}
