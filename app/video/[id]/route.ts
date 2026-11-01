import { type NextRequest, NextResponse } from "next/server"

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Pet Tales AI Video Proxy Service
 * Transforms Supabase storage URLs to Pet Tales AI branded URLs
 * Example: https://www.pettaleai.com/video/{uuid}.mp4
 */

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const videoId = id.replace(".mp4", "")

  console.log(`🎬 Pet Tales AI Video Proxy: Serving video ${videoId}`)

  try {
    // Validate UUID format
    if (!UUID_REGEX.test(videoId)) {
      console.error(`❌ Invalid UUID format: ${videoId}`)
      return NextResponse.json({ error: "Invalid video ID format" }, { status: 400 })
    }

    // Construct Supabase storage URL
    const supabaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/merged-videos/pet-tale-${videoId}.mp4`
    console.log(`📡 Fetching from Supabase: ${supabaseUrl}`)

    // Get Range header for video streaming support
    const range = request.headers.get("range")
    const headers: HeadersInit = {}

    if (range) {
      headers["Range"] = range
      console.log(`📊 Range request: ${range}`)
    }

    // Fetch video from Supabase storage
    const response = await fetch(supabaseUrl, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`❌ Video not found: ${videoId}`)
        return NextResponse.json({ error: "Video not found" }, { status: 404 })
      }
      throw new Error(`Supabase fetch failed: ${response.statusText}`)
    }

    console.log(`✅ Video served successfully: ${videoId}`)

    // Create response with Pet Tales AI branding headers
    const videoResponse = new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000", // 1 year cache
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "X-Pet-Tales-AI": "video-proxy-v1",
        "X-Powered-By": "Pet Tales AI",
        ...(response.headers.get("content-length") && {
          "Content-Length": response.headers.get("content-length")!,
        }),
        ...(response.headers.get("content-range") && {
          "Content-Range": response.headers.get("content-range")!,
        }),
      },
    })

    return videoResponse
  } catch (error) {
    console.error(`❌ Pet Tales AI Video Proxy Error for ${videoId}:`, error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * HEAD request for video metadata
 */
export async function HEAD(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const videoId = id.replace(".mp4", "")

  console.log(`📋 Pet Tales AI Video Metadata: ${videoId}`)

  try {
    // Validate UUID format
    if (!UUID_REGEX.test(videoId)) {
      return new NextResponse(null, { status: 400 })
    }

    // Construct Supabase storage URL
    const supabaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/merged-videos/pet-tale-${videoId}.mp4`

    // HEAD request to Supabase
    const response = await fetch(supabaseUrl, { method: "HEAD" })

    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }

    // Return metadata headers
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "X-Pet-Tales-AI": "video-proxy-v1",
        "X-Powered-By": "Pet Tales AI",
        ...(response.headers.get("content-length") && {
          "Content-Length": response.headers.get("content-length")!,
        }),
      },
    })
  } catch (error) {
    console.error(`❌ Pet Tales AI Video Metadata Error for ${videoId}:`, error)
    return new NextResponse(null, { status: 500 })
  }
}

/**
 * OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  console.log(`🔧 Pet Tales AI Video Proxy: CORS preflight`)

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
      "X-Pet-Tales-AI": "video-proxy-v1",
      "X-Powered-By": "Pet Tales AI",
    },
  })
}
