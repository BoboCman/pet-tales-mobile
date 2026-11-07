import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { getAppBaseUrl } from "@/lib/utils/app-url"
import { getElevenLabsVoiceId, ALL_VOICES } from "@/lib/voice-personalities"
import { internalAuthHeaders } from "@/lib/api/internal-auth"
import { isInternalRequest } from "@/lib/api/internal-auth"

export const maxDuration = 300

function getVoiceId(narrationStyle?: string): string {
  const defaultVoice = "baby_innocent"

  const voiceId = narrationStyle ? getElevenLabsVoiceId(narrationStyle) : getElevenLabsVoiceId(defaultVoice)

  console.log(`🔊 Voice mapping: ${narrationStyle || "undefined"} → ${voiceId}`)

  if (!voiceId) {
    console.warn(`⚠️ No voice found for style: ${narrationStyle}, using default: ${defaultVoice}`)
    return getElevenLabsVoiceId(defaultVoice)
  }

  return voiceId
}

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const startTime = Date.now()
  console.log("🎤 =====================================")
  console.log("🎤 ELEVENLABS TTS GENERATION API")
  console.log("🎤 Timestamp:", new Date().toISOString())
  console.log("🎤 Function timeout: 300 seconds")
  console.log("🎤 Model: eleven_multilingual_v2")
  console.log("🎤 =====================================")

  let entryId: string

  try {
    const body = await request.json()
    entryId = body.entryId
    let text = body.text as string | undefined

    console.log("📦 Request received:")
    console.log("  - Entry ID:", entryId)
    console.log("  - Text provided:", !!text)

    if (!entryId) {
      console.error("❌ Missing entryId")
      return NextResponse.json({ error: "entryId is required" }, { status: 400 })
    }

    // If text is not provided, fetch from database
    if (!text) {
      console.log("📖 Text not provided, fetching from database...")

      const { data: entryData, error: fetchError } = await supabaseAdmin
        .from("diary_entries")
        .select("content, narration_style")
        .eq("id", entryId)
        .single()

      if (fetchError || !entryData) {
        console.error("❌ Failed to fetch diary entry:", fetchError)
        return NextResponse.json({ error: "Diary entry not found" }, { status: 404 })
      }

      if (!entryData.content) {
        console.error("❌ No content found in diary entry")
        return NextResponse.json({ error: "No content available for TTS" }, { status: 400 })
      }

      text = entryData.content
      const narrationStyle = entryData.narration_style

      console.log("✅ Fetched from database:")
      console.log("  - Content length:", text.length, "characters")
      console.log("  - Narration style:", narrationStyle || "not set")

      // Get voice ID based on narration style
      const voiceId = getVoiceId(narrationStyle)

      // Update status to processing
      await supabaseAdmin
        .from("diary_entries")
        .update({
          tts_status: "processing",
          tts_processing_started_at: new Date().toISOString(),
          tts_error: null,
        })
        .eq("id", entryId)

      console.log("💾 TTS status updated to processing")

      // Call ElevenLabs TTS API
      console.log("🎙️ Calling ElevenLabs TTS API...")
      console.log("  - Voice ID:", voiceId)
      console.log("  - Model: eleven_multilingual_v2")
      console.log("  - Text length:", text.length, "characters")

      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
        }),
      })

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text()
        console.error("❌ ElevenLabs API error:", ttsResponse.status, errorText)
        throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`)
      }

      console.log("✅ ElevenLabs TTS completed successfully")

      // Get audio buffer
      const audioBuffer = await ttsResponse.arrayBuffer()
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })

      console.log("🎵 Audio generated:")
      console.log("  - Size:", audioBlob.size, "bytes")
      console.log("  - Type: audio/mpeg")

      // Upload to Supabase storage
      console.log("📤 Uploading to Supabase storage...")
      const fileName = `${entryId}_voiceover.mp3`
      const filePath = `voiceovers/${fileName}`

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("pet-voices")
        .upload(filePath, audioBlob, {
          contentType: "audio/mpeg",
          upsert: true,
        })

      if (uploadError) {
        console.error("❌ Supabase upload error:", uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage.from("pet-voices").getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl
      console.log("✅ Upload successful:")
      console.log("  - File path:", filePath)
      console.log("  - Public URL:", publicUrl.substring(0, 80) + "...")

      // Update database with completed status
      await supabaseAdmin
        .from("diary_entries")
        .update({
          tts_status: "completed",
          voiceover_url: publicUrl,
          tts_processing_completed_at: new Date().toISOString(),
          tts_error: null,
        })
        .eq("id", entryId)

      // Check if we should trigger merged video creation
      const { data: entry, error: triggerFetchError } = await supabaseAdmin
        .from("diary_entries")
        .select("compression_status, optimized_video_url, merged_video_status")
        .eq("id", entryId)
        .single()

      if (triggerFetchError || !entry) {
        console.warn("⚠️ Could not fetch entry for auto-trigger check:", triggerFetchError)
      } else {
        console.log("🔍 Checking auto-trigger conditions after TTS completion:")
        console.log("  - Compression status:", entry.compression_status)
        console.log("  - Has optimized video URL:", !!entry.optimized_video_url)
        console.log("  - Merged video status:", entry.merged_video_status)

        // Auto-trigger merged video creation if conditions are met
        if (
          entry.compression_status === "completed" &&
          entry.optimized_video_url &&
          (!entry.merged_video_status ||
            entry.merged_video_status === "pending" ||
            entry.merged_video_status === "not_requested")
        ) {
console.log("🚀 Auto-triggering merged video creation after TTS completion...")
  
  // Retry logic for transient network errors (ECONNRESET, etc.)
  const maxRetries = 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      
      const mergedVideoResponse = await fetch(`${getAppBaseUrl()}/api/cloudinary/merged-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
        body: JSON.stringify({ entryId }),
      })
      
      if (mergedVideoResponse.ok) {
        const responseData = await mergedVideoResponse.json()
        console.log("✅ Merged video creation triggered successfully from TTS:", responseData)
        lastError = null
        break
      } else {
        const errorText = await mergedVideoResponse.text()
        console.error(`⚠️ Failed to trigger merged video (attempt ${attempt}/${maxRetries}):`)
        console.error("  - Status:", mergedVideoResponse.status)
        console.error("  - Error:", errorText)
      }
    } catch (triggerError) {
      lastError = triggerError as Error
      console.warn(`⚠️ Auto-trigger attempt ${attempt}/${maxRetries} failed:`, triggerError)
      if (attempt < maxRetries) {
        console.log(`  Retrying in ${2 * (attempt + 1)} seconds...`)
      }
    }
  }
  
  if (lastError) {
    console.error("❌ All auto-trigger attempts failed. Merge may be triggered by another path.")
  }
        } else {
          console.log("⏸️ Auto-trigger conditions not met after TTS completion")
          console.log("  - Waiting for compression to complete or merged video already in progress")
        }
      }

      const processingTime = Date.now() - startTime
      console.log("🎉 =====================================")
      console.log("🎉 ELEVENLABS TTS SUCCESS!")
      console.log("🎉 Entry ID:", entryId)
      console.log("🎉 Voice used:", voiceId)
      console.log("🎉 Model: eleven_multilingual_v2")
      console.log("🎉 Audio size:", audioBlob.size, "bytes")
      console.log("🎉 Processing time:", `${processingTime}ms`)
      console.log("🎉 Public URL:", publicUrl.substring(0, 80) + "...")
      console.log("🎉 =====================================")

      return NextResponse.json({
        success: true,
        entryId,
        voiceoverUrl: publicUrl,
        voiceId,
        audioSize: audioBlob.size,
        processingTime: `${processingTime}ms`,
        message: "ElevenLabs TTS generation completed successfully",
        elevenlabs_details: {
          voice_mapping: {
            narration_style: narrationStyle || "default",
            voice_id: voiceId,
            voice_name: ALL_VOICES.find((voice) => voice.elevenLabsVoiceId === voiceId)?.label || "unknown",
          },
          model: "eleven_multilingual_v2",
          voice_settings: "using_stored_settings",
          cost_estimate: `~$${(text.length * 0.00003).toFixed(4)} USD`,
        },
      })
    } else {
      // Handle case where text was provided in request body (shouldn't happen in normal flow)
      const voiceId = getVoiceId()

      // Update status to processing
      await supabaseAdmin
        .from("diary_entries")
        .update({
          tts_status: "processing",
          tts_processing_started_at: new Date().toISOString(),
          tts_error: null,
        })
        .eq("id", entryId)

      console.log("💾 TTS status updated to processing")

      // Call ElevenLabs TTS API
      console.log("🎙️ Calling ElevenLabs TTS API...")
      console.log("  - Voice ID:", voiceId)
      console.log("  - Model: eleven_multilingual_v2")
      console.log("  - Text length:", text.length, "characters")

      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
        }),
      })

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text()
        console.error("❌ ElevenLabs API error:", ttsResponse.status, errorText)
        throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText}`)
      }

      console.log("✅ ElevenLabs TTS completed successfully")

      // Get audio buffer
      const audioBuffer = await ttsResponse.arrayBuffer()
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })

      console.log("🎵 Audio generated:")
      console.log("  - Size:", audioBlob.size, "bytes")
      console.log("  - Type: audio/mpeg")

      // Upload to Supabase storage
      console.log("📤 Uploading to Supabase storage...")
      const fileName = `${entryId}_voiceover.mp3`
      const filePath = `voiceovers/${fileName}`

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("pet-voices")
        .upload(filePath, audioBlob, {
          contentType: "audio/mpeg",
          upsert: true,
        })

      if (uploadError) {
        console.error("❌ Supabase upload error:", uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage.from("pet-voices").getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl
      console.log("✅ Upload successful:")
      console.log("  - File path:", filePath)
      console.log("  - Public URL:", publicUrl.substring(0, 80) + "...")

      // Update database with completed status
      await supabaseAdmin
        .from("diary_entries")
        .update({
          tts_status: "completed",
          voiceover_url: publicUrl,
          tts_processing_completed_at: new Date().toISOString(),
          tts_error: null,
        })
        .eq("id", entryId)

      // Auto-trigger merged video creation if compression is already done.
      // This branch handles n8n calls that supply text directly — without this
      // check, the merge is never triggered when text is pre-built by n8n.
      const { data: entryForTrigger, error: triggerFetchError } = await supabaseAdmin
        .from("diary_entries")
        .select("compression_status, optimized_video_url, merged_video_status")
        .eq("id", entryId)
        .single()

      if (triggerFetchError || !entryForTrigger) {
        console.warn("⚠️ Could not fetch entry for auto-trigger check (text path):", triggerFetchError)
      } else {
        console.log("🔍 Checking auto-trigger conditions after TTS completion (text path):")
        console.log("  - Compression status:", entryForTrigger.compression_status)
        console.log("  - Has optimized video URL:", !!entryForTrigger.optimized_video_url)
        console.log("  - Merged video status:", entryForTrigger.merged_video_status)

        if (
          entryForTrigger.compression_status === "completed" &&
          entryForTrigger.optimized_video_url &&
          (!entryForTrigger.merged_video_status ||
            entryForTrigger.merged_video_status === "pending" ||
            entryForTrigger.merged_video_status === "not_requested")
        ) {
          console.log("🚀 Auto-triggering merged video creation after TTS completion (text path)...")

          // Retry logic for transient network errors (ECONNRESET, etc.)
          const maxRetries = 3
          let lastError: Error | null = null
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))

              const mergedVideoResponse = await fetch(
                `${getAppBaseUrl()}/api/cloudinary/merged-video`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
                  body: JSON.stringify({ entryId }),
                },
              )

              if (mergedVideoResponse.ok) {
                console.log("✅ Merged video creation triggered successfully from TTS (text path)")
                lastError = null
                break
              } else {
                console.error(
                  `⚠️ Failed to trigger merged video (attempt ${attempt}/${maxRetries}):`,
                  await mergedVideoResponse.text(),
                )
              }
            } catch (triggerError) {
              lastError = triggerError as Error
              console.warn(`⚠️ Auto-trigger attempt ${attempt}/${maxRetries} failed:`, triggerError)
              if (attempt < maxRetries) {
                console.log(`  Retrying in ${2 * (attempt + 1)} seconds...`)
              }
            }
          }
          
          if (lastError) {
            console.error("❌ All auto-trigger attempts failed (text path). Merge may be triggered by another path.")
          }
        } else {
          console.log("⏸️ Auto-trigger conditions not met after TTS completion (text path)")
        }
      }

      const processingTime = Date.now() - startTime
      console.log("🎉 =====================================")
      console.log("🎉 ELEVENLABS TTS SUCCESS!")
      console.log("🎉 Entry ID:", entryId)
      console.log("🎉 Voice used:", voiceId)
      console.log("🎉 Model: eleven_multilingual_v2")
      console.log("🎉 Audio size:", audioBlob.size, "bytes")
      console.log("🎉 Processing time:", `${processingTime}ms`)
      console.log("🎉 Public URL:", publicUrl.substring(0, 80) + "...")
      console.log("🎉 =====================================")

      return NextResponse.json({
        success: true,
        entryId,
        voiceoverUrl: publicUrl,
        voiceId,
        audioSize: audioBlob.size,
        processingTime: `${processingTime}ms`,
        message: "ElevenLabs TTS generation completed successfully",
        elevenlabs_details: {
          voice_mapping: {
            voice_id: voiceId,
            voice_name: ALL_VOICES.find((voice) => voice.elevenLabsVoiceId === voiceId)?.label || "unknown",
          },
          model: "eleven_multilingual_v2",
          voice_settings: "using_stored_settings",
          cost_estimate: `~$${(text.length * 0.00003).toFixed(4)} USD`,
        },
      })
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("💥 =====================================")
    console.error("💥 ELEVENLABS TTS ERROR")
    console.error("💥 Error:", error)
    console.error("💥 Processing time:", `${processingTime}ms`)
    console.error("💥 =====================================")

    // Update database with error
    try {
      await supabaseAdmin
        .from("diary_entries")
        .update({
          tts_status: "failed",
          tts_error: error instanceof Error ? error.message : "ElevenLabs TTS generation failed",
          tts_processing_completed_at: new Date().toISOString(),
        })
        .eq("id", entryId)
    } catch (updateError) {
      console.error("Failed to update error status:", updateError)
    }

    return NextResponse.json(
      {
        error: "ElevenLabs TTS generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        processingTime: `${processingTime}ms`,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ELEVENLABS TTS GENERATION API",
    version: "elevenlabs_v4_multilingual_character_voices",
    timestamp: new Date().toISOString(),
    timeout: "300 seconds",
    voice_personalities: ALL_VOICES.map((voice) => ({
      value: voice.value,
      label: voice.label,
      description: voice.description,
      elevenLabsVoiceId: voice.elevenLabsVoiceId,
    })),
    elevenlabs_config: {
      model: "eleven_multilingual_v2",
      voice_settings: "configured_per_voice_in_elevenlabs_dashboard",
      voice_settings_note: "Each voice ID has optimal settings stored in ElevenLabs dashboard",
      output_format: "mp3",
      estimated_cost: "$0.30 per 1000 characters",
    },
  })
}
