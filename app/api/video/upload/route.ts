import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredit, refundCredit } from "@/lib/credits/operations-admin"
import { checkRateLimit } from "@/lib/redis/rate-limiter"
import { cleanQuirks } from "@/lib/pets/personality"

// Server-side upload limit, shared across serverless instances via Redis (Upstash).
// Separate key from the client pre-check (video_upload, 3/hour) so one upload isn't counted twice.
const MAX_UPLOADS_PER_HOUR = 20
const UPLOAD_API_RATE_LIMIT = {
  limit: MAX_UPLOADS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
  keyPrefix: "video_upload_api",
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("❌ Unauthorized video upload attempt:", {
        ip: request.headers.get("x-forwarded-for"),
        timestamp: new Date().toISOString(),
        error: authError?.message,
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    const rateLimitResult = await checkRateLimit(userId, UPLOAD_API_RATE_LIMIT)
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      console.warn("⚠️ Rate limit exceeded for video upload:", {
        userId,
        remaining: rateLimitResult.remaining,
      })
      return NextResponse.json(
        {
          error: "Too many uploads",
          retryAfter: retryAfter,
          message: "You've reached your upload limit. Please wait before uploading more videos.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": MAX_UPLOADS_PER_HOUR.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          },
        },
      )
    }

    console.log("✅ Authenticated video upload:", {
      userId,
      rateLimitRemaining: rateLimitResult.remaining,
    })

    // STEP 3: Parse request body
    const body = await request.json()
    const {
      video_url,
      pet_id,
      narration_style,
      narration_genre, // Added narration_genre extraction
      video_metadata,
      pet_name,
      pet_type,
      pet_breed,
      pet_gender,
      pet_age,
      personality_energy,
      personality_sociability,
      personality_confidence,
      personality_obedience,
      personality_play_style,
      personality_curiosity,
      personality_territorial,
    } = body

    // STEP 4: Validate required fields
    if (!video_url || !pet_id) {
      console.error("❌ Missing required fields:", { video_url, pet_id })
      return NextResponse.json({ error: "Missing required fields: video_url, pet_id" }, { status: 400 })
    }

    // STEP 5: Verify user owns this pet
    const { data: pet, error: petError } = await supabase
      .from("pets")
      .select("user_id, name, type, breed, gender, pet_age")
      .eq("id", pet_id)
      .single()

    if (petError || !pet) {
      console.error("❌ Pet not found:", petError)
      return NextResponse.json({ error: "Pet not found" }, { status: 404 })
    }

    if (pet.user_id !== userId) {
      console.error("❌ Unauthorized pet access:", {
        userId,
        petId: pet_id,
        petOwnerId: pet.user_id,
      })
      return NextResponse.json({ error: "You do not have permission to upload videos for this pet" }, { status: 403 })
    }

    // Check processing is configured BEFORE taking a tale
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL // NOT NEXT_PUBLIC!
    if (!n8nWebhookUrl) {
      console.error("❌ N8N_WEBHOOK_URL not configured")
      return NextResponse.json({ error: "Video processing service unavailable" }, { status: 500 })
    }

    // STEP 6: PREFLIGHT - Check user has sufficient credits
    const { data: userData, error: balanceError } = await supabase
      .from("users")
      .select("free_credits, purchased_credits, email")
      .eq("id", userId)
      .single()

    if (balanceError) {
      console.error("❌ Failed to fetch user balance:", balanceError)
      return NextResponse.json({ error: "Failed to verify credit balance" }, { status: 500 })
    }

    const currentBalance = (userData.free_credits ?? 0) + (userData.purchased_credits ?? 0)
    console.log("💳 Credit check:", {
      userId,
      free: userData.free_credits,
      purchased: userData.purchased_credits,
      total: currentBalance,
    })

    if (currentBalance < 1) {
      console.warn("❌ Insufficient credits:", {
        userId,
        balance: currentBalance,
      })
      return NextResponse.json(
        {
          error: "Insufficient credits",
          balance: currentBalance,
          message: "You need at least 1 credit to create a tale. Purchase more credits to continue.",
        },
        { status: 402 },
      )
    }

    console.log("✅ Credit check passed:", currentBalance, "credits")

    console.log("💳 Deducting 1 credit immediately...")

    const deductResult = await deductCredit(userId)

    if (deductResult.error) {
      console.error("❌ Credit deduction failed:", deductResult.error)

      // Log the failure for monitoring
      console.log("credit_deduction_failed", {
        user_id: userId,
        error: deductResult.error.message,
        balance_before: currentBalance,
      })

      return NextResponse.json(
        {
          error: "Credit deduction failed",
          message: "Unable to process credit. Please try again or contact support.",
        },
        { status: 500 },
      )
    }

    const newBalance = deductResult.data?.total ?? 0

    console.log("✅ Credit deducted successfully!")
    console.log("📊 Balance updated:", {
      user_id: userId,
      balance_before: currentBalance,
      balance_after: newBalance,
      deducted: 1,
    })

    // Update variable for response
    const credits_remaining = newBalance

    // STEP 7: Trigger n8n workflow (securely from backend)

    // Owner's free-text quirks, read from the database (not the request). Its own query so an
    // upload never fails if the column isn't there yet.
    let pet_quirks: string | null = null
    {
      const { data: quirksRow, error: quirksError } = await supabase
        .from("pets")
        .select("personality_quirks")
        .eq("id", pet_id)
        .maybeSingle()
      if (!quirksError) pet_quirks = cleanQuirks((quirksRow as any)?.personality_quirks)
    }

    const n8nPayload = {
      video_url,
      pet_id,
      user_id: userId, // Use authenticated userId
      pet_name: pet_name || pet.name,
      pet_type: pet_type || pet.type,
      pet_breed: pet_breed || pet.breed,
      pet_gender: pet_gender || pet.gender,
      pet_age: pet_age || pet.pet_age,
      personality_energy: personality_energy ?? null,
      personality_sociability: personality_sociability ?? null,
      personality_confidence: personality_confidence ?? null,
      personality_obedience: personality_obedience ?? null,
      personality_play_style: personality_play_style ?? null,
      personality_curiosity: personality_curiosity ?? null,
      personality_territorial: personality_territorial ?? null,
      pet_quirks: pet_quirks ?? "",
      narration_style: narration_style || "british_narrator",
      narration_genre: narration_genre || "comedy", // Added narration_genre to payload
      video_metadata,
      email: userData.email,
      processing_id: body.processing_id,
      analysis_type: body.analysis_type || "journal",
      timestamp: new Date().toISOString(),
      entry_date: new Date().toISOString().split("T")[0],
      direct_storage: true,
      caption_style: "standard",
      content: "",
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }

    console.log("🎭 Personality traits:", {
      energy: personality_energy ?? "not set",
      sociability: personality_sociability ?? "not set",
      confidence: personality_confidence ?? "not set",
      obedience: personality_obedience ?? "not set",
      play_style: personality_play_style ?? "not set",
      curiosity: personality_curiosity ?? "not set",
      territorial: personality_territorial ?? "not set",
      quirks: pet_quirks ? `${pet_quirks.length} chars` : "not set",
    })

    console.log("🎙️ Narration settings:", {
      voice: narration_style || "british_narrator (default)",
      genre: narration_genre || "comedy (default)",
    })

    console.log("🎬 Triggering n8n workflow:", {
      userId,
      petId: pet_id,
      videoUrl: video_url.substring(0, 50) + "...",
    })

    let n8nResponse: Response | null = null
    try {
      n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Optional: Add your own secret header for additional security
        "X-Internal-Secret": process.env.N8N_INTERNAL_SECRET || "",
      },
        body: JSON.stringify(n8nPayload),
      })
    } catch (triggerError) {
      console.error("❌ n8n workflow trigger threw:", triggerError)
    }

    if (!n8nResponse || !n8nResponse.ok) {
      console.error("❌ n8n workflow trigger failed:", {
        status: n8nResponse?.status,
        statusText: n8nResponse?.statusText,
      })
      // Refund only when n8n clearly never received the job (unreachable, webhook missing, or down).
      // Other errors may mean the workflow did start, and refunding those would hand out free tales.
      const neverStarted = !n8nResponse || [404, 502, 503].includes(n8nResponse.status)
      let refunded = false
      if (neverStarted) {
        const refund = await refundCredit(userId, deductResult.deductedFrom ?? "free", "processing_failed_to_start")
        refunded = !refund.error
        if (refund.error) console.error("❌ Refund after failed trigger also failed:", refund.error)
      }
      return NextResponse.json({ error: "Failed to start video processing", credit_refunded: refunded }, { status: 500 })
    }

    console.log("✅ n8n workflow triggered successfully")

    return NextResponse.json({
      success: true,
      message: "Video upload successful. Processing will begin shortly.",
      credits_remaining: credits_remaining, // New balance after deduction
      credit_deducted: true,
      deducted_amount: 1,
    })
  } catch (error) {
    console.error("❌ Video upload error:", error)
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
