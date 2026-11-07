import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { RateLimiter } from "@/lib/api/auth-middleware"
import { internalAuthHeaders } from "@/lib/api/internal-auth"

export const maxDuration = 300

// Initialize Supabase admin client to bypass RLS
const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// This protects against abuse even with valid webhook secret
const n8nRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (request: Request) => {
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    return `n8n-direct:${ip}`
  },
})

// Helper function to trigger TTS generation with personality traits
async function triggerTTS(entryId: string, baseUrl: string) {
  console.log("🎙️ Triggering TTS generation for entry:", entryId)
  try {
    // Fetch the entry data to get the pet_id
    const { data: entryData, error: entryError } = await supabaseAdmin
      .from("diary_entries")
      .select("*, pets(*)")
      .eq("id", entryId)
      .single()

    if (entryError) {
      console.error("⚠️ Failed to fetch entry data:", entryError)
      throw new Error(`Failed to fetch entry data: ${entryError.message}`)
    }

    // Extract personality traits from the pet data if available
    const personalityTraits = entryData.pets
      ? {
          personality_energy: entryData.pets.personality_energy,
          personality_sociability: entryData.pets.personality_sociability,
          personality_confidence: entryData.pets.personality_confidence,
          personality_obedience: entryData.pets.personality_obedience,
          personality_play_style: entryData.pets.personality_play_style,
          personality_curiosity: entryData.pets.personality_curiosity,
          personality_territorial: entryData.pets.personality_territorial,
        }
      : {}

    console.log("🐾 Personality traits for TTS:", personalityTraits)

    const ttsResponse = await fetch(new URL("/api/tts/generate", baseUrl).toString(), {
      method: "POST",
      headers: {
        ...internalAuthHeaders(),
        "Content-Type": "application/json",
        // Pass the webhook secret to bypass auth in the TTS endpoint
        "X-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET || "",
      },
      body: JSON.stringify({
        entryId,
        personalityTraits,
      }),
    })

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text()
      console.error("⚠️ Failed to trigger TTS generation:", errorText)
      throw new Error(`TTS generation failed: ${errorText}`)
    }

    console.log("✅ TTS generation triggered successfully")
    return { success: true }
  } catch (error) {
    console.error("⚠️ Error triggering TTS generation:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Helper function to trigger video compression
async function triggerCompression(entryId: string, videoUrl: string, baseUrl: string) {
  console.log("🎬 Triggering video compression for entry:", entryId)
  try {
    // Try the original working compression endpoint
    const compressionResponse = await fetch(new URL("/api/video/compress", baseUrl).toString(), {
      method: "POST",
      headers: {
        ...internalAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entryId,
        videoUrl,
      }),
    })

    if (!compressionResponse.ok) {
      const errorText = await compressionResponse.text()
      console.error("⚠️ Failed to trigger video compression:", errorText)
      throw new Error(`Video compression failed: ${errorText}`)
    }

    const result = await compressionResponse.json()
    console.log("✅ Video compression completed:", result.status)
    return { success: true, result }
  } catch (error) {
    console.error("⚠️ Error triggering video compression:", error)
    // Update database to mark compression as failed
    try {
      await supabaseAdmin.from("diary_entries").update({ compression_status: "failed" }).eq("id", entryId)
      console.log("📝 Updated compression status to failed for entry:", entryId)
    } catch (dbError) {
      console.error("⚠️ Failed to update compression status:", dbError)
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// This is a direct endpoint that bypasses middleware
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get("x-webhook-secret")
    if (!webhookSecret || webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      console.error("❌ Unauthorized n8n-direct webhook attempt:", {
        ip: request.headers.get("x-forwarded-for"),
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rateLimitResult = n8nRateLimiter.check(request)
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      console.warn("⚠️ Rate limit exceeded for n8n-direct webhook:", {
        ip: request.headers.get("x-forwarded-for"),
        timestamp: new Date().toISOString(),
        remaining: rateLimitResult.remaining,
        resetIn: retryAfter,
      })
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: retryAfter,
          message: "Rate limit exceeded. Please wait before retrying.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
          },
        },
      )
    }

    console.log("✅ Authenticated n8n-direct webhook:", {
      ip: request.headers.get("x-forwarded-for") || "unknown",
      timestamp: new Date().toISOString(),
      rateLimitRemaining: rateLimitResult.remaining,
    })

    console.log("📥 Received request to n8n-direct webhook endpoint")
    // Parse the payload
    let payload
    try {
      payload = await request.json()
      console.log("📦 Received payload:", JSON.stringify(payload, null, 2))
    } catch (e) {
      console.error("❌ Failed to parse JSON payload:", e)
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    // Extract the body field if it exists (n8n sometimes wraps the data)
    const data = payload.body || payload

    // Log the structure we're working with
    console.log("📦 Processing data structure:", JSON.stringify(data, null, 2))

    // Log narration_style and pet_age specifically
    console.log("🎙️ Narration style received:", data.narration_style)
    console.log("🎭 Narration genre received:", data.narration_genre) // Added narration_genre logging
    console.log("🐾 Pet age received:", data.pet_age)

    // Log product recommendation fields specifically
    console.log("🛍️ Product name received:", data.product_name)
    console.log("🔗 Product link received:", data.product_link ? data.product_link.substring(0, 50) + "..." : null)
    console.log("📦 Product category received:", data.product_category)

    // Log if personality traits are present in the payload, but don't try to insert them
    if (
      data.personality_energy ||
      data.personality_sociability ||
      data.personality_confidence ||
      data.personality_obedience ||
      data.personality_play_style ||
      data.personality_curiosity ||
      data.personality_territorial
    ) {
      console.log("🐾 Personality traits detected in payload but will not be inserted into diary_entries:", {
        energy: data.personality_energy,
        sociability: data.personality_sociability,
        confidence: data.personality_confidence,
        obedience: data.personality_obedience,
        play_style: data.personality_play_style,
        curiosity: data.personality_curiosity,
        territorial: data.personality_territorial,
      })
    }

    // Validate required fields
    if (!data.pet_id) {
      console.error("❌ Missing pet_id in payload")
      return NextResponse.json({ error: "pet_id is required" }, { status: 400 })
    }

    if (!data.user_id) {
      console.error("❌ Missing user_id in payload")
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    if (!data.video_url) {
      console.error("❌ Missing video_url in payload")
      return NextResponse.json({ error: "video_url is required" }, { status: 400 })
    }

    // **FIX 1: Check for duplicate entries by video URL**
    console.log("🔍 Checking for existing entry with video URL:", data.video_url)
    const { data: existingEntry, error: duplicateCheckError } = await supabaseAdmin
      .from("diary_entries")
      .select("id, enhancement_status")
      .eq("video_url", data.video_url)
      .maybeSingle()

    if (duplicateCheckError) {
      console.error("⚠️ Error checking for duplicate entries:", duplicateCheckError)
      return NextResponse.json({ error: "Failed to check for duplicates" }, { status: 500 })
    }

    if (existingEntry) {
      console.log("♻️ Found existing entry with same video URL:", existingEntry.id)
      // **FIX 3: Check enhancement status before triggering TTS**
      const shouldTriggerTTS =
        existingEntry.enhancement_status === "pending" || existingEntry.enhancement_status === "failed"

      if (shouldTriggerTTS) {
        console.log("🎙️ Existing entry needs TTS processing, triggering...")
        const ttsResult = await triggerTTS(existingEntry.id, request.url)
        if (!ttsResult.success) {
          return NextResponse.json({
            success: true,
            entry_id: existingEntry.id,
            warning: "Existing entry found but TTS generation failed",
            tts_error: ttsResult.error,
          })
        }
      } else {
        console.log("✅ Existing entry already processed or in progress")
      }

      return NextResponse.json({
        success: true,
        entry_id: existingEntry.id,
        message: "Existing diary entry found",
        duplicate_prevented: true,
      })
    }

    const entryData = {
      pet_id: data.pet_id,
      user_id: data.user_id,
      video_url: data.video_url,
      pet_name: data.pet_name || null,
      pet_type: data.pet_type || null,
      pet_breed: data.pet_breed || null,
      pet_gender: data.pet_gender || null,
      pet_age: data.pet_age || null, // Added pet_age field
      narration_style: data.narration_style || "british_narrator", // Added narration_style with default
      narration_genre: data.narration_genre || "comedy", // Added narration_genre field
      title: data.title || "Untitled Entry",
      content: data.content || null,
      mood: data.mood || null,
      tags: data.tags || null,
      behavior_category: data.behaviorCategory || data.behavior_category || null,
      analysis_type: data.analysisType || data.analysis_type || null,
      thumbnail_url: data.thumbnail_url || null,
      entry_date: data.entry_date || new Date().toISOString().split("T")[0],
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      enhancement_status: data.enhancement_status || "pending",
      compression_status: "pending",
      tts_status: "pending",
      caption_status: "pending",
      merged_video_status: "pending",
      // Product recommendation fields
      product_name: data.product_name || null,
      product_link: data.product_link || null,
      product_category: data.product_category || null,
      // DO NOT include personality trait fields here
    }

    console.log("📦 Inserting entry data:", JSON.stringify(entryData, null, 2))

    // Insert the diary entry
    const { data: newEntry, error: insertError } = await supabaseAdmin
      .from("diary_entries")
      .insert(entryData)
      .select()
      .single()

    if (insertError) {
      console.error("⚠️ Error inserting diary entry:", insertError)
      return NextResponse.json({ error: "Failed to insert diary entry", details: insertError.message }, { status: 500 })
    }

    console.log("✅ Diary entry created successfully with ID:", newEntry.id)
    console.log("🎙️ Narration style saved:", newEntry.narration_style)
    console.log("🎭 Narration genre saved:", newEntry.narration_genre) // Added narration_genre logging
    console.log("🐾 Pet age saved:", newEntry.pet_age)
    console.log("🛍️ Product name saved:", newEntry.product_name)
    console.log("📦 Product category saved:", newEntry.product_category)

    // Fire-and-forget so n8n never waits on Cloudinary
    triggerCompression(newEntry.id, newEntry.video_url, request.url).catch((error) => {
      console.error("⚠️ Video compression trigger failed (not awaited):", error)
    })

    // **FIX 3: Only trigger TTS if enhancement status is pending or failed**
    if (newEntry.enhancement_status === "pending" || newEntry.enhancement_status === "failed") {
      console.log("🎙️ Triggering TTS for new entry...")
      const ttsResult = await triggerTTS(newEntry.id, request.url)
      if (!ttsResult.success) {
        return NextResponse.json({
          success: true,
          entry_id: newEntry.id,
          warning: "Entry created but TTS generation failed",
          tts_error: ttsResult.error,
        })
      }
    } else {
      console.log("⏭️ Skipping TTS trigger - entry already processed or in progress")
    }

    return NextResponse.json({
      success: true,
      entry_id: newEntry.id,
      message: "Diary entry created and TTS generation triggered",
      credit_already_deducted: true,
      note: "Credit was deducted at upload time by /api/video/upload",
    })
  } catch (error) {
    console.error("❌ Unhandled exception in webhook handler:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
