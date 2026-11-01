import { NextResponse } from "next/server"
import { getPublicTales } from "@/lib/supabase/public-server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    console.log("API: Fetching public tales...")
    const tales = await getPublicTales()
    console.log("API: Found tales:", tales.length)
    console.log(
      "API: First tale:",
      tales[0] ? { id: tales[0].id, title: tales[0].title, petName: tales[0].pets?.name } : "No tales",
    )

    return NextResponse.json(tales)
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json({ error: "Failed to fetch public tales" }, { status: 500 })
  }
}
