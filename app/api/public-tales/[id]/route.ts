import { type NextRequest, NextResponse } from "next/server"
import { getPublicTaleById } from "@/lib/supabase/public-server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("API: Fetching public tale:", params.id)

    const tale = await getPublicTaleById(params.id)

    if (!tale) {
      console.log("API: Tale not found:", params.id)
      return NextResponse.json({ error: "Tale not found" }, { status: 404 })
    }

    console.log("API: Successfully fetched tale:", {
      id: tale.id,
      title: tale.title,
      petName: tale.pets?.name,
      viewCount: tale.view_count,
      likeCount: tale.like_count,
    })

    return NextResponse.json(tale)
  } catch (error) {
    console.error("API: Error fetching public tale:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
