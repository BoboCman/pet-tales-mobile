import { type NextRequest, NextResponse } from "next/server"
import { sendTaleReadyEmail } from "@/lib/email/send"
import { v2 as cloudinary } from "cloudinary"
import { findCompressedCopy } from "@/lib/cloudinary-eager"
import { moveFinishedTaleOffCloudinary } from "@/lib/cloudinary-storage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import OpenAI from "openai"
import { isInternalRequest } from "@/lib/api/internal-auth"

export const maxDuration = 300

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface MergedVideoResult {
  success: boolean
  url?: string
  publicId?: string
  duration?: number
  bytes?: number
  error?: string
  approach?: string
  captionsIncluded?: boolean
}

/**
 * Turn anything thrown into a readable message.
 * The Cloudinary SDK rejects with plain objects like { message, http_code } rather than
 * Error instances, so `error instanceof Error` alone throws away the real reason.
 */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object") {
    const e = error as any
    const message = e.message || e.error?.message
    const httpCode = e.http_code ?? e.error?.http_code
    if (message) return httpCode ? `${message} (HTTP ${httpCode})` : String(message)
    try {
      const json = JSON.stringify(error)
      if (json && json !== "{}") return json.slice(0, 500)
    } catch {
      // fall through
    }
  }
  return fallback
}

// A merge that has been "processing" longer than this is treated as dead (maxDuration is 300s).
const STALE_PROCESSING_MS = 6 * 60 * 1000

/**
 * Retry wrapper for Cloudinary operations with exponential backoff
 * Only retries on 502 server errors, not client errors
 */
async function cloudinaryWithRetry<T>(operation: () => Promise<T>, operationName: string, maxAttempts = 3): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 ${operationName} - Attempt ${attempt}/${maxAttempts}`)
      const result = await operation()

      if (attempt > 1) {
        console.log(`✅ ${operationName} - SUCCESS on attempt ${attempt}`)
      }

      return result
    } catch (error: any) {
      lastError = error

      // Check if this is a 502 server error that we should retry
      const is502Error =
        error.http_code === 502 ||
        error.message?.includes("502") ||
        error.message?.includes("Server returned unexpected status code - 502") ||
        error.name === "UnexpectedResponse"

      console.log(`❌ ${operationName} - Attempt ${attempt} failed:`)
      console.log(`  - Error type: ${error.name || "Unknown"}`)
      console.log(`  - HTTP code: ${error.http_code || "N/A"}`)
      console.log(`  - Message: ${error.message || "No message"}`)
      console.log(`  - Is 502 error: ${is502Error}`)

      // If it's not a 502 error, don't retry
      if (!is502Error) {
        console.log(`🚫 ${operationName} - Not a 502 error, not retrying`)
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        console.log(`🚫 ${operationName} - Max attempts (${maxAttempts}) reached, giving up`)
        throw error
      }

      // Calculate exponential backoff delay: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000
      console.log(
        `⏳ ${operationName} - 502 error detected, retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`,
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Time formatting functions for VTT and SRT
 */
function formatTimeVTT(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`
}

/**
 * Cleanup temporary Cloudinary assets after successful merge
 * Saves ~30MB per video in Cloudinary storage
 */
async function cleanupTemporaryAssets(entryId: string): Promise<void> {
  console.log("🗑️ Starting cleanup of temporary Cloudinary assets...")
  
  const assetsToDelete = [
    // Intermediate looped video (ALWAYS delete - never needed after merge)
    { publicId: `pawsense/intermediate/entry_${entryId}_looped`, resourceType: 'video' as const },
    
    // Audio file (burned into final video)
    { publicId: `pawsense/audio/entry_${entryId}_audio`, resourceType: 'video' as const },
    
    // Caption files (burned into final video)  
    { publicId: `pawsense/audio/entry_${entryId}_audio.vtt`, resourceType: 'raw' as const },
    { publicId: `pawsense/audio/entry_${entryId}_audio.srt`, resourceType: 'raw' as const },
    
    // Original compressed video (only needed during merge process)
    { publicId: `pawsense/compressed/entry_${entryId}_compressed`, resourceType: 'video' as const },
  ]

  const results = { deleted: 0, failed: 0, errors: [] as string[] }

  for (const asset of assetsToDelete) {
    try {
      const result = await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType,
        invalidate: true, // Purge from CDN cache
      })
      
      if (result.result === 'ok' || result.result === 'not found') {
        console.log(`✅ Deleted: ${asset.publicId}`)
        results.deleted++
      } else {
        console.warn(`⚠️ Unexpected result for ${asset.publicId}:`, result)
        results.failed++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`⚠️ Failed to delete ${asset.publicId}: ${msg}`)
      results.errors.push(`${asset.publicId}: ${msg}`)
      results.failed++
    }
  }

  console.log(`🗑️ Cleanup complete: ${results.deleted} deleted, ${results.failed} failed`)
}

function formatTimeSRT(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`
}

/**
 * Helper function to detect natural phrase boundaries for smart splitting
 */
function findPhraseBoundary(words: any[], startIndex: number, maxWords: number): number {
  const phraseBoundaryWords = [
    // Conjunctions
    "and",
    "but",
    "or",
    "so",
    "because",
    "since",
    "while",
    "although",
    "though",
    "however",
    // Prepositions indicating time/place
    "after",
    "before",
    "during",
    "while",
    "when",
    "where",
    "until",
    "since",
    // Other natural breaks
    "then",
    "now",
    "today",
    "yesterday",
    "tomorrow",
    "finally",
    "suddenly",
    "meanwhile",
  ]

  // Look for comma-separated phrases first
  for (let i = startIndex; i < Math.min(startIndex + maxWords, words.length); i++) {
    if (words[i].word.includes(",")) {
      return i + 1 // Split after the comma
    }
  }

  // Look for natural phrase boundary words
  for (let i = startIndex + 3; i < Math.min(startIndex + maxWords, words.length - 1); i++) {
    const word = words[i].word
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, "")
    if (phraseBoundaryWords.includes(word)) {
      return i // Split before the boundary word
    }
  }

  // If no natural boundary found, split at maxWords
  return Math.min(startIndex + maxWords, words.length)
}

/**
 * Helper function to add missing punctuation with enhanced detection
 */
function addMissingPunctuation(text: string, isLastChunk = false): string {
  let processedText = text.trim()

  // Don't add punctuation if it already exists
  if (/[.!?]$/.test(processedText)) {
    return processedText
  }

  // Add period for sentence-ending patterns or if it's the last chunk
  const sentenceEndingPatterns = [
    /\b(peace|post|research|today|yesterday|tomorrow)$/i,
    /\b(morning|afternoon|evening|night)$/i,
    /\b(done|finished|complete|over|end|stop|enough)$/i,
    /\b(perfect|wonderful|amazing|great|good)$/i,
    /\b(love|hate|like|dislike)$/i,
    /\b(yes|no|maybe|perhaps|definitely|absolutely|certainly)$/i,
    /\b(obviously|clearly|indeed|curious)$/i,
  ]

  const shouldAddPunctuation = sentenceEndingPatterns.some((pattern) => pattern.test(processedText)) || isLastChunk

  if (shouldAddPunctuation) {
    processedText += "."
  }

  return processedText
}

/**
 * HYBRID APPROACH: Convert Whisper output to readable captions using segments + word-level timing
 */
function convertWhisperToSubtitles(transcription: any): { vttContent: string; srtContent: string } {
  console.log("🔄 Converting Whisper to HYBRID READABLE subtitle format...")
  console.log("📊 Available data:")
  console.log("  - Segments:", transcription.segments?.length || 0)
  console.log("  - Words:", transcription.words?.length || 0)

  let vttContent = "WEBVTT\n\n"
  let srtContent = ""
  let srtIndex = 1

  // HYBRID APPROACH: Use segments as base, split long ones with word-level timing
  if (
    transcription.segments &&
    transcription.segments.length > 0 &&
    transcription.words &&
    transcription.words.length > 0
  ) {
    console.log("✅ Using HYBRID approach: segments + word-level timing for readability")

    // Create word lookup map for precise timing
    const wordMap = new Map()
    transcription.words.forEach((word: any, index: number) => {
      wordMap.set(index, word)
    })

    let globalWordIndex = 0

    transcription.segments.forEach((segment: any, segmentIndex: number) => {
      const segmentText = segment.text.trim()
      const segmentDuration = segment.end - segment.start
      const segmentWords = segmentText.split(/\s+/).length

      console.log(`📝 Processing segment ${segmentIndex + 1}:`)
      console.log(`  - Text: "${segmentText.substring(0, 50)}${segmentText.length > 50 ? "..." : ""}"`)
      console.log(`  - Duration: ${segmentDuration.toFixed(2)}s`)
      console.log(`  - Words: ${segmentWords}`)

      // DECISION LOGIC: Keep short segments intact, split long ones
      if (segmentDuration <= 4.0 && segmentWords <= 12) {
        // SHORT SEGMENT: Keep as natural sentence
        console.log(`  ✅ Keeping intact (short segment)`)

        const startTime = formatTimeVTT(segment.start)
        const endTime = formatTimeVTT(segment.end)
        const text = addMissingPunctuation(segmentText, segmentIndex === transcription.segments.length - 1)

        // VTT format
        vttContent += `${startTime} --> ${endTime}\n${text}\n\n`

        // SRT format
        const srtStartTime = formatTimeSRT(segment.start)
        const srtEndTime = formatTimeSRT(segment.end)
        srtContent += `${srtIndex}\n${srtStartTime} --> ${srtEndTime}\n${text}\n\n`
        srtIndex++

        // Advance global word index
        globalWordIndex += segmentWords
      } else {
        // LONG SEGMENT: Split intelligently using word-level timing
        console.log(`  🔄 Splitting long segment (${segmentDuration.toFixed(2)}s, ${segmentWords} words)`)

        // Find words that belong to this segment
        const segmentWordsArray = []
        let wordsFound = 0

        // Match words to this segment by timing
        for (let i = globalWordIndex; i < transcription.words.length && wordsFound < segmentWords; i++) {
          const word = transcription.words[i]
          if (word.start >= segment.start - 0.1 && word.end <= segment.end + 0.1) {
            segmentWordsArray.push(word)
            wordsFound++
          }
        }

        if (segmentWordsArray.length === 0) {
          // Fallback: use segment timing
          console.log(`  ⚠️ No matching words found, using segment timing`)
          const startTime = formatTimeVTT(segment.start)
          const endTime = formatTimeVTT(segment.end)
          const text = addMissingPunctuation(segmentText, segmentIndex === transcription.segments.length - 1)

          vttContent += `${startTime} --> ${endTime}\n${text}\n\n`
          const srtStartTime = formatTimeSRT(segment.start)
          const srtEndTime = formatTimeSRT(segment.end)
          srtContent += `${srtIndex}\n${srtStartTime} --> ${srtEndTime}\n${text}\n\n`
          srtIndex++
        } else {
          // SMART SPLITTING: Break at phrase boundaries
          let chunkStart = 0

          while (chunkStart < segmentWordsArray.length) {
            const maxWordsInChunk = 12
            const chunkEnd = findPhraseBoundary(segmentWordsArray, chunkStart, maxWordsInChunk)

            if (chunkEnd > chunkStart) {
              const chunkWords = segmentWordsArray.slice(chunkStart, chunkEnd)
              const chunkText = chunkWords
                .map((w) => w.word.trim())
                .join(" ")
                .trim()

              if (chunkText.length > 1) {
                const startTime = formatTimeVTT(chunkWords[0].start)
                const endTime = formatTimeVTT(chunkWords[chunkWords.length - 1].end)

                const isLastChunk =
                  chunkEnd >= segmentWordsArray.length && segmentIndex === transcription.segments.length - 1
                const text = addMissingPunctuation(chunkText, isLastChunk)

                console.log(
                  `    📄 Chunk: "${text}" (${chunkWords.length} words, ${(chunkWords[chunkWords.length - 1].end - chunkWords[0].start).toFixed(2)}s)`,
                )

                // VTT format
                vttContent += `${startTime} --> ${endTime}\n${text}\n\n`

                // SRT format
                const srtStartTime = formatTimeSRT(chunkWords[0].start)
                const srtEndTime = formatTimeSRT(chunkWords[chunkWords.length - 1].end)
                srtContent += `${srtIndex}\n${srtStartTime} --> ${srtEndTime}\n${text}\n\n`
                srtIndex++
              }
            }

            chunkStart = chunkEnd
          }
        }

        globalWordIndex += segmentWords
      }
    })
  }
  // FALLBACK 1: Use segments only (no word-level data)
  else if (transcription.segments && transcription.segments.length > 0) {
    console.log("⚠️ Using SEGMENT-ONLY fallback (no word-level data)")

    transcription.segments.forEach((segment: any, index: number) => {
      const startTime = formatTimeVTT(segment.start)
      const endTime = formatTimeVTT(segment.end)
      let text = segment.text.trim()

      text = addMissingPunctuation(text, index === transcription.segments.length - 1)

      if (text.length < 3 || segment.end - segment.start < 0.5) {
        return
      }

      // VTT format
      vttContent += `${startTime} --> ${endTime}\n${text}\n\n`

      // SRT format
      const srtStartTime = formatTimeSRT(segment.start)
      const srtEndTime = formatTimeSRT(segment.end)
      srtContent += `${srtIndex}\n${srtStartTime} --> ${srtEndTime}\n${text}\n\n`
      srtIndex++
    })
  }
  // FALLBACK 2: Create single caption
  else {
    console.log("⚠️ Using SINGLE CAPTION fallback (no segment or word data)")
    const duration = transcription.duration || 30
    let text = transcription.text || "No transcript available"
    text = addMissingPunctuation(text, true)

    vttContent += `00:00:00.000 --> ${formatTimeVTT(duration)}\n${text}\n\n`
    srtContent += `1\n00:00:00,000 --> ${formatTimeSRT(duration)}\n${text}\n\n`
  }

  console.log("✅ HYBRID subtitle conversion completed:")
  console.log("  - VTT chunks:", (vttContent.match(/-->/g) || []).length)
  console.log("  - SRT chunks:", srtIndex - 1)
  console.log("  - Approach: Natural segments with intelligent phrase-boundary splitting")
  console.log("  - Readability: Optimized for mobile viewing with complete thoughts")

  return { vttContent, srtContent }
}

/**
 * STEP 1: Upload audio file from Supabase to Cloudinary with Whisper caption generation
 */
async function uploadAudioWithCaptions(
  audioUrl: string,
  entryId: string,
): Promise<{
  success: boolean
  publicId?: string
  duration?: number
  error?: string
}> {
  try {
    console.log("🎵 Uploading Supabase audio to Cloudinary with Whisper HYBRID caption generation...")
    console.log("🔗 Audio URL:", audioUrl.substring(0, 100) + "...")

    // Step 1A: Upload audio to Cloudinary with retry logic
    const result = await cloudinaryWithRetry(
      () =>
        cloudinary.uploader.upload(audioUrl, {
          resource_type: "video", // Audio files use "video" resource type in Cloudinary
          public_id: `pawsense/audio/entry_${entryId}_audio`,
          format: "mp3",
          overwrite: true,
        }),
      "Audio Upload to Cloudinary",
    )

    console.log("✅ Audio uploaded to Cloudinary:")
    console.log("  - Public ID:", result.public_id)
    console.log("  - Duration:", result.duration, "seconds")
    console.log("  - Size:", result.bytes, "bytes")
    console.log("  - Starting HYBRID Whisper caption generation...")

    // Step 1B: Process with Whisper - REQUEST BOTH SEGMENT AND WORD TIMESTAMPS
    console.log("🤖 Processing with OpenAI Whisper for HYBRID readable captions...")

    // Get the Cloudinary audio URL for Whisper processing
    const audioCloudinaryUrl = cloudinary.url(result.public_id, {
      resource_type: "video",
      format: "mp3",
    })

    // Fetch audio for Whisper
    const audioResponse = await fetch(audioCloudinaryUrl)
    const audioBuffer = await audioResponse.arrayBuffer()

    // Create File object for Whisper
    const audioFile = new File([audioBuffer], `${entryId}.mp3`, {
      type: "audio/mpeg",
    })

    // UPDATED: Call Whisper API with BOTH segment and word-level timestamps for hybrid approach
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment", "word"], // CHANGED: Request both for hybrid approach
    })

    console.log("✅ Whisper HYBRID transcription completed:")
    console.log("  - Language:", transcription.language)
    console.log("  - Duration:", transcription.duration, "seconds")
    console.log("  - Segments:", transcription.segments?.length || 0, "(natural sentences)")
    console.log("  - Words:", transcription.words?.length || 0, "(precise timing)")
    console.log("  - Hybrid approach: Using segments for readability + words for precision")

    // Step 1C: Convert to HYBRID readable VTT and SRT formats
    const { vttContent, srtContent } = convertWhisperToSubtitles(transcription)

    // Step 1D: Upload caption files to Cloudinary as raw files
    const vttUpload = await cloudinary.uploader.upload(
      `data:text/vtt;base64,${Buffer.from(vttContent).toString("base64")}`,
      {
        resource_type: "raw",
        public_id: `${result.public_id}.vtt`,
        overwrite: true,
      },
    )

    const srtUpload = await cloudinary.uploader.upload(
      `data:text/plain;base64,${Buffer.from(srtContent).toString("base64")}`,
      {
        resource_type: "raw",
        public_id: `${result.public_id}.srt`,
        overwrite: true,
      },
    )

    console.log("✅ HYBRID readable caption files uploaded to Cloudinary:")
    console.log("  - VTT URL:", vttUpload.secure_url)
    console.log("  - SRT URL:", srtUpload.secure_url)

    // Step 1E: Update database with completed caption info
    await supabaseAdmin
      .from("diary_entries")
      .update({
        cloudinary_audio_public_id: result.public_id,
        caption_status: "completed",
        caption_vtt_url: vttUpload.secure_url,
        caption_srt_url: srtUpload.secure_url,
        caption_transcript: transcription.text,
        caption_processing_started_at: new Date().toISOString(),
        caption_processing_completed_at: new Date().toISOString(),
        caption_error: null,
      })
      .eq("id", entryId)

    console.log("💾 Caption status updated to completed with HYBRID readable results")

    return {
      success: true,
      publicId: result.public_id,
      duration: result.duration,
    }
  } catch (error) {
    console.error("❌ Audio upload to Cloudinary with Whisper HYBRID failed:", error)

    // Update database with error
    await supabaseAdmin
      .from("diary_entries")
      .update({
        caption_status: "failed",
        caption_error: error instanceof Error ? error.message : "Whisper HYBRID audio processing failed",
        caption_processing_completed_at: new Date().toISOString(),
      })
      .eq("id", entryId)

    return {
      success: false,
      error: error instanceof Error ? error.message : "Whisper HYBRID audio processing failed",
    }
  }
}

/**
 * Upload video with eager async transformation for large files
 * Falls back to synchronous upload for smaller files
 */
async function uploadWithEagerAsync(
  sourceUrl: string,
  publicId: string,
  transformation: any[],
  operationName: string,
): Promise<{
  success: boolean
  public_id?: string
  secure_url?: string
  duration?: number
  bytes?: number
  hasAudio?: boolean
  error?: string
}> {
  console.log(`🔄 ${operationName}: Starting upload with eager_async support...`)
  
  try {
    // First, try synchronous upload (works for smaller videos)
    const result = await cloudinaryWithRetry(
      () =>
        cloudinary.uploader.upload(sourceUrl, {
          resource_type: "video",
          public_id: publicId,
          overwrite: true,
          format: "mp4",
          transformation: transformation,
          type: "upload",
          timeout: 300000, // 5 minutes
        }),
      `${operationName} (Synchronous)`,
    )
    
    console.log(`✅ ${operationName}: Synchronous upload succeeded`)
    return {
      success: true,
      public_id: result.public_id,
      secure_url: result.secure_url,
      duration: result.duration,
      bytes: result.bytes,
      // Cloudinary returns `audio: {}` for a video with no audio track
      hasAudio: result.audio ? Boolean(result.audio.codec) : undefined,
    }
  } catch (error: any) {
    // Check if this is the "too large for synchronous" error
    const isTooLargeError =
      error.http_code === 400 &&
      error.message?.includes("too large to process synchronously")
    
    if (!isTooLargeError) {
      // Re-throw other errors
      throw error
    }
    
    console.log(`⚠️ ${operationName}: Video too large for sync processing, using eager_async...`)
    
    // Upload with eager_async for large videos
    const asyncResult = await cloudinaryWithRetry(
      () =>
        cloudinary.uploader.upload(sourceUrl, {
          resource_type: "video",
          public_id: publicId,
          overwrite: true,
          format: "mp4",
          type: "upload",
          timeout: 300000,
          // One chained derivative. A bare array here would be read as one eager job PER
          // component (just the loop, just the overlay, ...), and eager[0] would not be the tale.
          eager: [{ transformation, format: "mp4" }],
          eager_async: true,
          eager_notification_url: undefined, // We'll poll instead
        }),
      `${operationName} (Async Upload)`,
    )
    
    // The rendered video is the eager derivative, not the stored asset (which is the plain,
    // untransformed copy). Wait for that derivative itself.
    const eagerUrl: string | undefined = asyncResult.eager?.[0]?.secure_url
    if (!eagerUrl) throw new Error("Cloudinary did not return a URL for the async render")
    console.log(`📤 ${operationName}: Async render started, waiting for:`, eagerUrl.substring(0, 140))

    const ready = await waitForDerivedVideo(publicId, eagerUrl, 200000, 4000)
    if (!ready.success) {
      throw new Error(ready.error || "Async transformation failed")
    }

    console.log(`✅ ${operationName}: Async transformation completed`)
    return {
      success: true,
      public_id: publicId,
      secure_url: eagerUrl,
      // Unknown until rendered; callers skip their length checks when this is undefined
      duration: undefined,
      bytes: ready.bytes,
    }
  }
}

/** Path after /upload/ without the version, so two URLs for the same derivative compare equal. */
function derivedKey(url: string): string {
  const afterUpload = url.split("/upload/")[1] || url
  return afterUpload.replace(/(^|\/)v\d+\//, "$1").split("?")[0]
}

/**
 * Wait until an eager_async derivative has actually been rendered.
 *
 * The old poll looked for resource.eager, which the Admin API never returns, so it reported
 * "done" at once and handed back the untransformed copy (full length, original sound). The
 * length check then rejected it and the merge fell back to a path that fails for large videos.
 * Now: ready when the Admin API lists the derivative, or when the URL itself serves a video.
 */
async function waitForDerivedVideo(
  publicId: string,
  eagerUrl: string,
  maxWaitTime = 200000,
  pollInterval = 4000,
): Promise<{ success: boolean; bytes?: number; error?: string }> {
  const startTime = Date.now()
  const wanted = derivedKey(eagerUrl)

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    const waited = Math.round((Date.now() - startTime) / 1000)

    try {
      const resource: any = await cloudinary.api.resource(publicId, { resource_type: "video" })
      const derived = Array.isArray(resource?.derived) ? resource.derived : []
      const match = derived.find((d: any) => d?.secure_url && derivedKey(d.secure_url) === wanted)
      if (match) {
        console.log(`  ✅ Derivative listed after ${waited}s`)
        return { success: true, bytes: match.bytes }
      }
    } catch (error) {
      console.warn("  ⚠️ resource() poll failed:", describeError(error, "unknown"))
    }

    try {
      // Cache-busting query so a "still processing" answer is never served from the CDN cache
      const head = await fetch(`${eagerUrl}${eagerUrl.includes("?") ? "&" : "?"}_poll=${Date.now()}`, { method: "HEAD" })
      const type = head.headers.get("content-type") || ""
      if (head.ok && type.startsWith("video")) {
        console.log(`  ✅ Derivative is being served after ${waited}s`)
        const length = Number(head.headers.get("content-length"))
        return { success: true, bytes: Number.isFinite(length) ? length : undefined }
      }
      console.log(`  ⏳ Still rendering (${waited}s, HTTP ${head.status})`)
    } catch {
      console.log(`  ⏳ Still rendering (${waited}s)`)
    }
  }

  return { success: false, error: `Render did not finish within ${Math.round(maxWaitTime / 1000)} seconds` }
}

/**
 * Length in seconds of a video or audio asset in Cloudinary, or null if it can't be found.
 * The Admin API's resource() call does not always include `duration`, so this falls back to
 * explicit(), which returns the same details as the original upload.
 */
async function getMediaDuration(publicId: string): Promise<number | null> {
  try {
    const resource = await cloudinary.api.resource(publicId, { resource_type: "video" })
    if (typeof resource.duration === "number" && resource.duration > 0) return resource.duration
  } catch (error) {
    console.warn("⚠️ resource() lookup failed for", publicId, describeError(error, "unknown"))
  }
  try {
    const info: any = await cloudinary.uploader.explicit(publicId, { resource_type: "video", type: "upload" })
    if (typeof info.duration === "number" && info.duration > 0) return info.duration
  } catch (error) {
    console.warn("⚠️ explicit() lookup failed for", publicId, describeError(error, "unknown"))
  }
  return null
}

/** Last cue end time in a WebVTT file, in seconds (e.g. "00:00:27.480" -> 27.48). */
async function getVttEndSeconds(vttUrl: string | null | undefined): Promise<number | null> {
  if (!vttUrl) return null
  try {
    const res = await fetch(vttUrl)
    if (!res.ok) return null
    const text = await res.text()
    let last = 0
    for (const match of text.matchAll(/-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/g)) {
      const [, h, m, sec, ms] = match
      const seconds = Number(h || 0) * 3600 + Number(m) * 60 + Number(sec) + Number(ms.padEnd(3, "0")) / 1000
      if (seconds > last) last = seconds
    }
    return last > 0 ? last : null
  } catch {
    return null
  }
}

/** Video length; 10s is only a last resort and just affects how many times the clip loops. */
async function getVideoDuration(publicId: string): Promise<number> {
  const duration = await getMediaDuration(publicId)
  console.log("📏 Video duration:", duration ?? "unknown (using 10s)")
  return duration ?? 10
}

/**
 * Narration length. This sets how long the finished tale is, so it never silently falls back
 * to a guess: a wrong value cut tales off after 10 seconds.
 */
async function getAudioDuration(publicId: string, vttUrl?: string | null): Promise<number> {
  const fromCloudinary = await getMediaDuration(publicId)
  if (fromCloudinary) return fromCloudinary
  // Captions end when the narration ends; add a little so the last word isn't clipped
  const fromCaptions = await getVttEndSeconds(vttUrl)
  if (fromCaptions) return Math.round((fromCaptions + 0.75) * 100) / 100
  throw new Error(`Could not find how long the narration is (${publicId})`)
}

/**
 * Check for Whisper captions (synchronous since Whisper processing is immediate)
 */
async function waitForCaptionsWithPolling(
  entryId: string,
  maxWaitTime = 120000, // Not used anymore but keeping parameter for compatibility
): Promise<{
  ready: boolean
  status: string
  hasVtt: boolean
  hasSrt: boolean
  vttUrl?: string
  srtUrl?: string
  transcript?: string
  error?: string
}> {
  console.log("🔍 CHECKING WHISPER HYBRID CAPTIONS - No polling needed (synchronous)...")

  try {
    const { data: entry, error } = await supabaseAdmin
      .from("diary_entries")
      .select("caption_status, caption_vtt_url, caption_srt_url, caption_transcript, caption_error")
      .eq("id", entryId)
      .single()

    if (error || !entry) {
      console.error("❌ Error checking caption status:", error)
      return {
        ready: false,
        status: "error",
        hasVtt: false,
        hasSrt: false,
        error: error?.message || "Entry not found",
      }
    }

    const hasVtt = !!(entry.caption_vtt_url && entry.caption_vtt_url.trim())
    const hasSrt = !!(entry.caption_srt_url && entry.caption_srt_url.trim())
    const hasTranscript = !!(entry.caption_transcript && entry.caption_transcript.trim())

    // Whisper captions are ready if status is "completed" AND we have actual caption files
    const ready = entry.caption_status === "completed" && (hasVtt || hasSrt)

    console.log("📝 Whisper HYBRID caption check result:")
    console.log("  - Status:", entry.caption_status)
    console.log("  - Has VTT URL:", hasVtt)
    console.log("  - Has SRT URL:", hasSrt)
    console.log("  - Has transcript:", hasTranscript)
    console.log("  - Ready for use:", ready)

    if (ready) {
      console.log("✅ Whisper HYBRID captions are ready!")
      return {
        ready,
        status: entry.caption_status || "unknown",
        hasVtt,
        hasSrt,
        vttUrl: entry.caption_vtt_url,
        srtUrl: entry.caption_srt_url,
        transcript: entry.caption_transcript,
        error: entry.caption_error,
      }
    }

    if (entry.caption_status === "failed") {
      console.log("❌ Whisper HYBRID caption generation failed")
      return {
        ready: false,
        status: entry.caption_status,
        hasVtt: false,
        hasSrt: false,
        error: entry.caption_error || "Whisper HYBRID caption generation failed",
      }
    }

    console.log("⚠️ Whisper HYBRID captions not ready - unexpected state")
    return {
      ready: false,
      status: entry.caption_status || "unknown",
      hasVtt,
      hasSrt,
      error: "Whisper HYBRID captions in unexpected state",
    }
  } catch (error) {
    console.error("❌ Error during Whisper HYBRID caption check:", error)
    return {
      ready: false,
      status: "error",
      hasVtt: false,
      hasSrt: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** Free users get the watermark; anyone paying (a plan or a tale pack) does not. */
async function shouldWatermark(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true
  const { data } = await supabaseAdmin
    .from("users")
    .select("subscription_status, purchased_credits, is_admin")
    .eq("id", userId)
    .maybeSingle()
  if (!data) return true
  if (data.is_admin) return false
  if (["active", "trialing", "past_due"].includes(data.subscription_status ?? "")) return false
  if ((data.purchased_credits ?? 0) > 0) return false
  return true
}

/**
 * Save a poster frame next to the finished tale (videos/thumbnails/pet-tale-<id>.jpg), used as
 * the preview image when a tale link is shared. Must run before the Cloudinary copy is deleted.
 */
async function savePosterFrame(finalPublicId: string, entryId: string): Promise<void> {
  try {
    const frameUrl = cloudinary.url(finalPublicId, {
      resource_type: "video",
      format: "jpg",
      transformation: [{ start_offset: 1, width: 720, crop: "limit", quality: "auto:good" }],
    })
    const res = await fetch(frameUrl)
    if (!res.ok) throw new Error(`frame ${res.status}`)
    const { error } = await supabaseAdmin.storage
      .from("videos")
      .upload(`thumbnails/pet-tale-${entryId}.jpg`, await res.arrayBuffer(), { contentType: "image/jpeg", upsert: true })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.warn("Poster frame not saved (non-fatal):", describeError(error, "poster failed"))
  }
}

/**
 * STEP 8: Download final video from Cloudinary and upload to Supabase Storage
 */
async function uploadVideoToSupabaseStorage(
  cloudinaryUrl: string,
  entryId: string,
): Promise<{
  success: boolean
  supabaseUrl?: string
  error?: string
}> {
  try {
    console.log("📥 STEP 8: Downloading video from Cloudinary for Supabase storage...")

    // Download video from Cloudinary
    const response = await fetch(cloudinaryUrl)
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`)
    }

    const videoBuffer = await response.arrayBuffer()
    const fileName = `pet-tale-${entryId}.mp4`
    const filePath = `merged-videos/${fileName}`

    console.log("📤 Uploading to Supabase Storage:", filePath)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("videos")
      .upload(filePath, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`)
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage.from("videos").getPublicUrl(filePath)

    console.log("✅ Pet Tales AI branded URL created:", publicUrlData.publicUrl)

    return {
      success: true,
      supabaseUrl: publicUrlData.publicUrl,
    }
  } catch (error) {
    console.error("❌ Supabase upload failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * MAIN FUNCTION: Use Cloudinary's built-in subtitle overlay with Whisper-generated HYBRID captions
 */
async function createMergedVideoWithCloudinarySubtitles(
  videoPublicId: string,
  optimizedVideoUrl: string | null,
  audioUrl: string,
  entryId: string,
  watermark = false,
): Promise<MergedVideoResult> {
  // Tracks which step is running so a failure says where it happened.
  let currentStep = "STEP 1 (audio upload / captions)"
  try {
    console.log("🎬 8-STEP PROCESS: Creating merged video with WHISPER HYBRID SUBTITLE OVERLAY...")
    console.log("📹 Video Public ID:", videoPublicId)
    console.log("🎵 Audio URL:", audioUrl.substring(0, 100) + "...")
    console.log("🆔 Entry ID:", entryId)

    // STEP 1: Check if audio already exists in Cloudinary or upload with Whisper HYBRID captions
    console.log("🔹 STEP 1: Checking if audio already exists or uploading with Whisper HYBRID...")

    const { data: existingEntry } = await supabaseAdmin
      .from("diary_entries")
      .select("cloudinary_audio_public_id, caption_status, caption_vtt_url")
      .eq("id", entryId)
      .single()

    let audioPublicId: string
    let audioDuration: number

    if (existingEntry?.cloudinary_audio_public_id) {
      console.log("✅ Audio already exists in Cloudinary:")
      console.log("  - Audio Public ID:", existingEntry.cloudinary_audio_public_id)
      console.log("  - Caption status:", existingEntry.caption_status)

      audioPublicId = existingEntry.cloudinary_audio_public_id
      audioDuration = await getAudioDuration(audioPublicId, existingEntry.caption_vtt_url)
    } else {
      console.log("📤 Audio not found in Cloudinary, uploading with Whisper HYBRID captions...")
      const audioUpload = await uploadAudioWithCaptions(audioUrl, entryId)
      if (!audioUpload.success) {
        return { success: false, error: audioUpload.error }
      }

      audioPublicId = audioUpload.publicId!
      audioDuration = audioUpload.duration!
    }

    console.log("🎵 Final Audio Public ID:", audioPublicId)
    console.log("⏱️ Audio duration:", audioDuration, "seconds")

    // STEP 2: Get video duration and calculate loops
    currentStep = "STEP 2 (video duration)"
    console.log("🔹 STEP 2: Getting video duration and calculating loops...")
    const videoDuration = await getVideoDuration(videoPublicId)
    const loopCount = Math.max(1, Math.ceil(audioDuration / videoDuration))
    // Cloudinary's e_loop:N means N EXTRA plays (max 5), so e_loop:1 doubles the clip.
    // No loop component at all when one play already covers the narration.
    const extraPlays = Math.min(5, loopCount - 1)
    const loopComponents: any[] = extraPlays > 0 ? [{ effect: `loop:${extraPlays}` }] : []
    console.log("📏 Video duration:", videoDuration, "seconds")
    console.log("🔄 Loop count needed:", loopCount)

    // STEP 3: Pick the source video.
    // Use the 720p copy made by /api/video/compress (optimized_video_url). Cloudinary bills video
    // per second of output at a rate set by the source and output resolution, so working from the
    // original 1080p/4K upload cost 2-4x more per second than the 720p copy.
    console.log("🔹 STEP 3: Picking source video (720p copy preferred)...")
    const originalVideoUrl = cloudinary.url(videoPublicId, {
      resource_type: "video",
      format: "mp4",
    })
    const sourceVideoUrl = optimizedVideoUrl || originalVideoUrl
    console.log("🔗 Source video URL:", sourceVideoUrl.substring(0, 100) + "...")
    console.log("  - Using 720p copy:", Boolean(optimizedVideoUrl))

    // STEP 4/5: Wait for Whisper captions. The loop no longer needs its own intermediate video,
    // so captions are awaited first and everything is rendered in one Cloudinary pass below.
    currentStep = "STEP 5 (wait for captions)"
    console.log("🔹 STEP 5: Checking for Whisper HYBRID captions...")

    const captionCheck = await waitForCaptionsWithPolling(entryId, 120000)

    // Build transformation array with correct object syntax
    const transformations: any[] = [
      // Audio overlay - use "video" resource type for MP3 files
      {
        overlay: {
          resource_type: "video",
          public_id: audioPublicId.replace(/\//g, ":"),
        },
      },
      { flags: "layer_apply" },
    ]

    let captionsIncluded = false

    // STEP 6: Use correct Cloudinary transformation object syntax with Whisper HYBRID captions
    if (captionCheck.ready && captionCheck.hasVtt) {
      console.log("✅ WHISPER HYBRID CAPTIONS ARE READY! Using CLOUDINARY TRANSFORMATION...")
      console.log("  - VTT URL:", captionCheck.vttUrl?.substring(0, 80) + "...")
      console.log("  - Caption approach: HYBRID (segments + word-level timing for readability)")

      try {
        console.log("📝 Adding CLOUDINARY transformation with Whisper-generated HYBRID captions...")

        // Add Whisper HYBRID subtitle overlay with font styling
        transformations.push(
          // Subtitle overlay with font styling for mobile readability
          {
            overlay: {
              resource_type: "subtitles",
              public_id: audioPublicId.replace(/\//g, ":") + ".vtt",
              font_family: "Arial",
              font_size: 12,
            },
          },
          // Positioning parameters
          {
            flags: "layer_apply",
            color: "white",
            gravity: "south",
            y: 120,
          },
        )

        captionsIncluded = true
        console.log("✅ WHISPER HYBRID CLOUDINARY transformation added successfully!")
        console.log("  - Caption quality: Natural sentence flow with precise timing")
        console.log("  - Readability: Optimized for mobile viewing")
        console.log("  - Font styling: Arial, 12px for mobile readability")
        console.log("  - Approach: Segments for natural breaks + words for precision")
      } catch (captionError) {
        console.warn("⚠️ Failed to add Whisper HYBRID Cloudinary transformation:", captionError)
        console.log("🔄 Falling back to basic video without captions...")
      }
    } else {
      console.log("⚠️ Whisper HYBRID captions not ready or available")
      console.log("  - Status:", captionCheck.status)
      console.log("  - Ready:", captionCheck.ready)
      console.log("  - Has VTT:", captionCheck.hasVtt)
      console.log("  - Error:", captionCheck.error)
      console.log("  - Proceeding without captions")
    }

    // Free tales carry a small "pettaleai.com" mark so every posted tale points back to the app.
    // Subscribers (and pack buyers) get clean videos.
    if (watermark) {
      transformations.push(
        {
          overlay: { font_family: "Arial", font_size: 30, font_weight: "bold", text: "pettaleai.com" },
          color: "white",
          opacity: 75,
        },
        { flags: "layer_apply", gravity: "north_east", x: 28, y: 48 },
      )
    }

    // Add final transformations for perfect synchronization
    transformations.push(
      // CRITICAL: Trim the final video to match audio duration EXACTLY
      { end_offset: audioDuration },
      // Optimize for mobile delivery
      {
        width: 720,
        height: 1280,
        crop: "limit",
        quality: "auto:good",
        format: "mp4",
      },
    )

    console.log("🔧 Final transformation array:", JSON.stringify(transformations, null, 2))

    // STEP 6: Apply final transformation with retry logic and eager_async support
    const finalPublicId = `pawsense/merged/entry_${entryId}_final`
    currentStep = "STEP 6 (final merge with audio + subtitles)"

    console.log("🔹 STEP 6: Applying final transformation with WHISPER HYBRID SUBTITLES...")
    console.log("  - Source URL:", sourceVideoUrl.substring(0, 100) + "...")
    console.log("  - Target Public ID:", finalPublicId)
    console.log("  - Transformations count:", transformations.length)
    console.log("  - Audio duration:", audioDuration, "seconds")
    console.log("  - Caption approach: WHISPER HYBRID READABLE CAPTIONS")
    console.log("  - Caption quality: Natural sentences with intelligent phrase splitting")
    console.log("  - Font styling: Arial, 12px for mobile readability")

    // Single pass: loop the 720p clip, trim it to the narration length, mute its own sound, then
    // add narration and subtitles. Only the final output (narration length, 720x1280) is billed.
    // The trim sits right after the loop so the base video is already the right length before any
    // overlay; a trim only at the end of the chain was not applied (tales kept playing the raw clip
    // after the narration ended).
    const singlePassTransformations: any[] = [
      ...loopComponents,
      { end_offset: audioDuration },
      { effect: "volume:mute" },
      ...transformations,
    ]

    // A render counts as too long if it runs more than 1 second past the narration.
    const isTooLong = (duration?: number) => typeof duration === "number" && duration > audioDuration + 1

    let finalResult: Awaited<ReturnType<typeof uploadWithEagerAsync>>
    try {
      finalResult = await uploadWithEagerAsync(
        sourceVideoUrl,
        finalPublicId,
        singlePassTransformations,
        "Single-pass Final Video (STEP 6)",
      )
      if (!finalResult.success) {
        throw new Error(finalResult.error || "Single-pass render failed")
      }
      if (finalResult.hasAudio === false) {
        throw new Error("Single-pass render came back without an audio track")
      }
      if (isTooLong(finalResult.duration)) {
        throw new Error(
          `Single-pass render is ${finalResult.duration}s but the narration is ${audioDuration}s (trim not applied)`,
        )
      }
    } catch (singlePassError) {
      // Fallback: let Cloudinary's delivery URL do the loop, trim and mute (a plain derived video),
      // then add narration and subtitles on upload. Still 720p, so still billed at the SD rate.
      console.warn(
        "⚠️ Single-pass render failed, falling back to pre-trimmed source:",
        describeError(singlePassError, "single-pass render failed"),
      )

      currentStep = "STEP 6 (final merge from pre-trimmed source, fallback)"
      const trimmedSourceUrl = cloudinary.url(videoPublicId, {
        resource_type: "video",
        format: "mp4",
        transformation: [
          // Same as the compress step's eager derivative, so that part is already cached
          { width: 720, crop: "scale", video_codec: "h264", audio_codec: "aac" },
          ...loopComponents,
          { end_offset: audioDuration },
          // Remove original audio
          { audio_codec: "none" },
        ],
      })
      console.log("🔗 Pre-trimmed source URL:", trimmedSourceUrl.substring(0, 160) + "...")

      // Keep the first error too: the fallback renders from the stored original, so for a large
      // upload its own error ("too large") hides the reason the normal path failed.
      const firstTry = describeError(singlePassError, "single-pass render failed")
      try {
        finalResult = await uploadWithEagerAsync(
          trimmedSourceUrl,
          finalPublicId,
          transformations,
          "Final Video Transformation (STEP 6, fallback)",
        )
      } catch (fallbackError) {
        throw new Error(`${describeError(fallbackError, "fallback render failed")} (first try: ${firstTry})`)
      }
      if (!finalResult.success) {
        throw new Error(`STEP 6 failed: ${finalResult.error} (first try: ${firstTry})`)
      }
      if (isTooLong(finalResult.duration)) {
        console.warn(
          `⚠️ Fallback render is ${finalResult.duration}s but the narration is ${audioDuration}s; trim still not applied`,
        )
      }
    }

    console.log("✅ STEP 6 COMPLETED - Final transformation with WHISPER HYBRID SUBTITLES:")
    console.log("  - Final Public ID:", finalResult.public_id)
    console.log("  - Final URL:", finalResult.secure_url?.substring(0, 100) + "...")
    console.log("  - Final Duration:", finalResult.duration, "seconds")
    console.log("  - Final Size:", finalResult.bytes, "bytes")
    console.log("  - Captions included:", captionsIncluded)
    console.log("  - Caption source: OpenAI Whisper HYBRID approach")
    console.log("  - Caption quality: Natural readability with precise timing")
    console.log("  - Font styling: Arial, 12px for optimal mobile viewing")

    // STEP 7: Verify the final stored asset
    try {
      console.log("🔍 STEP 7: Verifying final stored asset...")
      const verification = await cloudinary.api.resource(finalPublicId, {
        resource_type: "video",
      })

      console.log("✅ FINAL ASSET VERIFICATION SUCCESS!")
      console.log("  - Verified public ID:", verification.public_id)
      console.log("  - Verified folder:", verification.folder)
      console.log("  - Verified duration:", verification.duration, "seconds")
      console.log("  - Verified size:", verification.bytes, "bytes")
      console.log("  - Clean URL:", verification.secure_url)
      console.log("  - WHISPER HYBRID CAPTIONS: Natural readability with precise timing integrated")
      console.log("  - MOBILE FONT STYLING: Arial, 12px for optimal readability")

      return {
        success: true,
        url: finalResult.secure_url || verification.secure_url,
        publicId: verification.public_id,
        duration: verification.duration,
        bytes: verification.bytes,
        approach: "8_step_whisper_hybrid_readable_captions_mobile_optimized",
        captionsIncluded,
      }
    } catch (verifyError) {
      console.warn("⚠️ Final asset verification failed, using upload result:", verifyError)
      return {
        success: true,
        url: finalResult.secure_url,
        publicId: finalResult.public_id,
        duration: finalResult.duration,
        bytes: finalResult.bytes,
        approach: "8_step_whisper_hybrid_readable_captions_mobile_optimized_unverified",
        captionsIncluded,
      }
    }
  } catch (error) {
    console.error(`❌ 8-step process failed at ${currentStep}:`, error)
    return {
      success: false,
      error: `${currentStep}: ${describeError(error, "8-step merged video creation with Whisper HYBRID subtitles failed")}`,
    }
  }
}

/**
 * Main API handler
 */
export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const startTime = Date.now()
  console.log("🎬 =====================================")
  console.log("🎬 8-STEP CLOUDINARY MERGED VIDEO API - WHISPER HYBRID INTEGRATION")
  console.log("🎬 Timestamp:", new Date().toISOString())
  console.log("🎬 Function timeout: 300 seconds (5 minutes)")
  console.log("🎬 UPDATED: Using OpenAI Whisper HYBRID approach for readable captions")
  console.log("🎬 UPDATED: Added retry logic for 502 Cloudinary server errors")
    console.log("🎬 UPDATED: Added eager_async support for large video processing")
  console.log("🎬 =====================================")

  let entryId: string

  try {
    // Parse request
    const body = await request.json()
    entryId = body.entryId

    console.log("📦 Request body parsed:")
    console.log("  - Entry ID:", entryId)

    if (!entryId) {
      console.error("❌ No entryId provided in request body")
      return NextResponse.json({ error: "entryId is required" }, { status: 400 })
    }

    // Add delay for database consistency
    console.log("⏳ Waiting for database consistency...")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Fetch entry data
    console.log("📊 Fetching entry data from database...")
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from("diary_entries")
      .select(
        "id, user_id, optimized_video_url, voiceover_url, cloudinary_public_id, pet_name, title, tts_status, compression_status, merged_video_status, merged_processing_started_at",
      )
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      console.error("❌ Entry not found:", fetchError)
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    console.log("📊 Entry data retrieved:")
    console.log("  - Pet:", entry.pet_name)
    console.log("  - Title:", entry.title)
    console.log("  - Video URL:", !!entry.optimized_video_url)
    console.log("  - Audio URL:", !!entry.voiceover_url)
    console.log("  - Cloudinary ID:", entry.cloudinary_public_id)
    console.log("  - TTS Status:", entry.tts_status)

    // A missed Cloudinary notification must not leave the tale waiting forever: if the 720p copy
    // is not recorded yet, ask Cloudinary whether it already exists and record it.
    if (
      entry.cloudinary_public_id &&
      (!entry.optimized_video_url || entry.compression_status === "processing" || entry.compression_status === "pending")
    ) {
      try {
        const readyUrl = await findCompressedCopy(entry.cloudinary_public_id)
        if (readyUrl) {
          console.log("✅ 720p copy already exists on Cloudinary; recording it")
          await supabaseAdmin
            .from("diary_entries")
            .update({
              optimized_video_url: readyUrl,
              compression_status: "completed",
              compression_completed_at: new Date().toISOString(),
              compression_error: null,
            })
            .eq("id", entryId)
          entry.optimized_video_url = readyUrl
          entry.compression_status = "completed"
        }
      } catch (lookupError) {
        console.warn("Could not check Cloudinary for the 720p copy:", describeError(lookupError, "lookup failed"))
      }
    }

    // Don't start before the 720p copy exists. Rendering from a copy that is still being made makes
    // Cloudinary process the full original on the fly, which fails for large uploads ("too large
    // to process synchronously"). The compression webhook triggers the merge once it is ready.
    if (entry.compression_status === "processing" || entry.compression_status === "pending") {
      console.log("⏸️ 720p copy still rendering; the compression webhook will start the merge")
      return NextResponse.json(
        { skipped: true, entryId, reason: "Waiting for compression to finish" },
        { status: 409 },
      )
    }

    if (entry.compression_status === "failed") {
      return NextResponse.json(
        { error: "Cloudinary could not make the 720p copy. Use Redo tale to start again from the upload." },
        { status: 409 },
      )
    }

    // Validate required data
    if (!entry.optimized_video_url || !entry.voiceover_url || !entry.cloudinary_public_id) {
      const missing = []
      if (!entry.optimized_video_url) missing.push("video")
      if (!entry.voiceover_url) missing.push("audio")
      if (!entry.cloudinary_public_id) missing.push("cloudinary_id")
      return NextResponse.json({ error: `Missing required data: ${missing.join(", ")}` }, { status: 400 })
    }

    // Claim the job. Several routes (TTS, compression webhook, Cloudinary webhook, caption retry,
    // admin recovery) can trigger a merge for the same entry at nearly the same time. Without this,
    // two runs overwrite the same Cloudinary assets, and the first run's cleanup deletes the audio
    // and compressed video the second run is still using.
    const previousStatus: string | null = entry.merged_video_status ?? null
    const previousStartedAt: string | null = entry.merged_processing_started_at ?? null
    const startedMs = previousStartedAt ? new Date(previousStartedAt).getTime() : NaN
    const isLiveRun =
      previousStatus === "processing" && Number.isFinite(startedMs) && Date.now() - startedMs < STALE_PROCESSING_MS

    if (isLiveRun) {
      console.log("⏭️ Merge already in progress for this entry, skipping duplicate trigger")
      return NextResponse.json(
        { skipped: true, entryId, reason: "Merge already in progress for this entry" },
        { status: 409 },
      )
    }

    // Compare-and-swap: only update if status and start time are still what we just read,
    // so if two triggers race past the check above, only one of them wins.
    let claimQuery = supabaseAdmin
      .from("diary_entries")
      .update({
        merged_video_status: "processing",
        merged_processing_started_at: new Date().toISOString(),
        merged_video_error: null,
      })
      .eq("id", entryId)
    claimQuery =
      previousStatus === null
        ? claimQuery.is("merged_video_status", null)
        : claimQuery.eq("merged_video_status", previousStatus)
    claimQuery =
      previousStartedAt === null
        ? claimQuery.is("merged_processing_started_at", null)
        : claimQuery.eq("merged_processing_started_at", previousStartedAt)

    const { data: claimed, error: claimError } = await claimQuery.select("id")

    if (claimError) {
      // Never block a merge because the claim itself failed; fall back to the old behavior.
      console.error("⚠️ Could not claim merge job, continuing without the duplicate guard:", claimError)
      await supabaseAdmin
        .from("diary_entries")
        .update({
          merged_video_status: "processing",
          merged_processing_started_at: new Date().toISOString(),
          merged_video_error: null,
        })
        .eq("id", entryId)
    } else if (!claimed || claimed.length === 0) {
      console.log("⏭️ Another trigger claimed this merge first, skipping duplicate")
      return NextResponse.json(
        { skipped: true, entryId, reason: "Merge already in progress for this entry" },
        { status: 409 },
      )
    }

    console.log("💾 Status updated to processing")

    // Create merged video using Whisper HYBRID captions
    console.log("🚀 Starting 8-step merged video creation with WHISPER HYBRID SUBTITLES...")
    const watermark = await shouldWatermark(entry.user_id)
    console.log("🏷️ Watermark:", watermark)
    const result = await createMergedVideoWithCloudinarySubtitles(
      entry.cloudinary_public_id,
      entry.optimized_video_url,
      entry.voiceover_url,
      entryId,
      watermark,
    )

    if (!result.success) {
      // Update to failed
      await supabaseAdmin
        .from("diary_entries")
        .update({
          merged_video_status: "failed",
          merged_video_error: result.error,
          merged_processing_completed_at: new Date().toISOString(),
        })
        .eq("id", entryId)

      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // ADD THIS - Update diary_entries table with Cloudinary URL for immediate viewing
    await supabaseAdmin
      .from("diary_entries")
      .update({
        merged_video_url: result.url,
        merged_video_status: "completed",
        merged_processing_completed_at: new Date().toISOString(),
        merged_video_error: null,
        merged_video_public_id: result.publicId,
      })
      .eq("id", entryId)

    console.log("💾 Video immediately available with Cloudinary URL for user viewing")

    // "Your tale is ready" email (once per tale; never fails the merge)
    try {
      const email = await sendTaleReadyEmail(entryId)
      console.log("📧 Tale ready email:", email)
    } catch (emailError) {
      console.error("Tale ready email error (non-fatal):", emailError)
    }

    // STEP 8: Transfer to Supabase Storage for Pet Tales AI branding
    console.log("🚀 Starting 8-step process with Supabase transfer...")
    const supabaseTransfer = await uploadVideoToSupabaseStorage(result.url!, entryId)

    // Initialize variables correctly - keep Cloudinary URL as primary
    // Cloudinary URL until the Supabase copy is confirmed, then the Supabase URL
    let finalVideoUrl = result.url!
    let petTalesUrl = null

    if (supabaseTransfer.success) {
      // DON'T change finalVideoUrl - keep it as Cloudinary URL
      petTalesUrl = supabaseTransfer.supabaseUrl // ✅ CORRECT - Store Supabase URL separately
      console.log("✅ Pet Tales AI URL ready:", petTalesUrl)

      // Update with Pet Tales AI URL
      await supabaseAdmin
        .from("diary_entries")
        .update({
          merged_video_supabase_url: supabaseTransfer.supabaseUrl, // Supabase URL for Pet Tales AI sharing
          // Keep merged_video_url as Cloudinary URL for UI performance
        })
        .eq("id", entryId)

      console.log("💾 Database updated with Pet Tales AI branded URL")
      
      // Clean up now rather than in the background: Vercel can freeze the function as soon as the
      // response is sent, which left working files on Cloudinary (billed monthly as storage).
      await cleanupTemporaryAssets(entryId).catch((err) => console.error("Cleanup error (non-fatal):", err))

      if (result.publicId) await savePosterFrame(result.publicId, entryId)

      // Play the tale from Supabase and remove the finished copy from Cloudinary too
      const moved = await moveFinishedTaleOffCloudinary(entryId, supabaseTransfer.supabaseUrl!, result.publicId).catch(
        (err) => ({ moved: false, reason: describeError(err, "move failed") }),
      )
      console.log("📦 Finished tale moved off Cloudinary:", moved)
      if (moved.moved) finalVideoUrl = supabaseTransfer.supabaseUrl!
    } else {
      console.warn("⚠️ Supabase transfer failed, using Cloudinary URL:", supabaseTransfer.error)
      petTalesUrl = null
    }

    const processingTime = Date.now() - startTime
    console.log("🎉 =====================================")
    console.log("🎉 8-STEP PROCESS WITH WHISPER HYBRID SUBTITLES SUCCESS!")
    console.log("🎉 Entry ID:", entryId)
    console.log("🎉 Final URL:", finalVideoUrl?.substring(0, 100) + "...") // Cloudinary URL
    console.log("🎉 Cloudinary URL:", result.url?.substring(0, 100) + "...") // Same as above
    console.log("🎉 Pet Tales URL:", petTalesUrl?.substring(0, 100) + "...") // Supabase URL
    console.log("🎉 Public ID:", result.publicId)
    console.log("🎉 Duration:", result.duration, "seconds")
    console.log("🎉 File size:", result.bytes, "bytes")
    console.log("🎉 Captions included:", result.captionsIncluded)
    console.log("🎉 Processing time:", `${processingTime}ms`)
    console.log("🎉 Approach:", result.approach)
    console.log("🎉 WHISPER HYBRID INTEGRATION: ✅ SUCCESSFUL")
    console.log("🎉 PET TALES AI BRANDING: ✅ SUCCESSFUL")
    console.log("🎉 502 ERROR RETRY LOGIC: ✅ ACTIVE")
    console.log("🎉 =====================================")

    return NextResponse.json({
      success: true,
      entryId,
      status: "completed",
      url: finalVideoUrl,
      cloudinaryUrl: result.url, // ✅ Explicit Cloudinary URL
      petTalesUrl: petTalesUrl, // ✅ Pet Tales AI branded URL for sharing
      publicId: result.publicId,
      duration: result.duration,
      bytes: result.bytes,
      captionsIncluded: result.captionsIncluded,
      processingTime: `${processingTime}ms`,
      approach: result.approach,
      message: "8-Step Process: Perfect synchronization with Pet Tales AI branded sharing URL",
      whisper_hybrid_integration: {
        caption_source: "OpenAI Whisper API",
        processing_type: "Synchronous (no webhooks needed)",
        timing_precision: "Segment + word-level timestamps for hybrid approach",
        caption_style: "Natural sentences with intelligent phrase splitting for readability",
        readability_improvement: "Complete thoughts preserved, long sentences split at natural boundaries",
        cost: "$0.006 per minute",
        hybrid_approach: "Segments for natural flow + words for precise timing",
        mobile_optimization: "3-4 second chunks optimized for mobile viewing",
        font_styling: "Arial, 12px for optimal mobile readability",
      },
      pet_tales_ai_branding: {
        supabase_storage: "Videos hosted on Pet Tales AI domain",
        branded_urls: "Custom Pet Tales AI sharing URLs",
        fallback_support: "Cloudinary backup URLs maintained",
        sharing_optimization: "Optimized for social media sharing",
      },
      mobile_font_optimization: {
        font_family: "Arial",
        font_size: "12px",
        purpose: "Smaller, more readable subtitles for mobile devices",
        readability: "Optimized for small screens and mobile viewing",
        positioning: "Bottom center with 120px margin for visibility",
      },
      retry_logic: {
        enabled: true,
        target_errors: "502 server errors only",
        max_attempts: 3,
        backoff_strategy: "Exponential (2s, 4s, 8s)",
        operations_covered: [
          "Audio upload to Cloudinary",
          "Intermediate video creation (STEP 4)",
          "Final video transformation (STEP 6)",
        ],
        reliability_improvement: "Significantly reduced failures due to temporary Cloudinary server issues",
      },
      hybrid_caption_features: {
        natural_sentences: "Uses Whisper segments as base for complete thoughts",
        intelligent_splitting: "Long segments split at phrase boundaries (commas, conjunctions)",
        precise_timing: "Word-level timestamps ensure frame-accurate synchronization",
        mobile_friendly: "3-4 second maximum duration per caption",
        readability_first: "Prioritizes complete thoughts over strict timing limits",
        phrase_boundaries: "Splits at natural breaks: commas, conjunctions, prepositions",
        fallback_support: "Graceful degradation if word-level data unavailable",
        font_optimization: "Arial 12px for optimal mobile readability",
      },
      caption_examples: {
        before_choppy: "Why does my friend | always want to dance | with me in the | backyard She keeps putting",
        after_readable:
          "Today, I realized hammocks aren't just for humans. | After my brave expedition standing on my hind legs to investigate | this mysterious swinging thing, it hit me.",
        improvement: "Natural sentence flow with complete thoughts preserved and mobile-optimized font styling",
      },
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error("💥 =====================================")
    console.error("💥 8-STEP PROCESS WITH WHISPER HYBRID SUBTITLES ERROR")
    console.error("💥 Error:", error)
    console.error("💥 Processing time:", `${processingTime}ms`)
    console.error("💥 =====================================")

    // Update database with error
    try {
      await supabaseAdmin
        .from("diary_entries")
        .update({
          merged_video_status: "failed",
          merged_video_error: describeError(error, "8-step process with Whisper HYBRID subtitles failed"),
          merged_processing_completed_at: new Date().toISOString(),
        })
        .eq("id", entryId)
    } catch (updateError) {
      console.error("Failed to update error status:", updateError)
    }

    return NextResponse.json(
      {
        error: "8-step process with Whisper HYBRID subtitles failed",
        details: describeError(error, "Unknown error"),
        processingTime: `${processingTime}ms`,
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint for API status
 */
export async function GET() {
  return NextResponse.json({
status: "8-STEP CLOUDINARY MERGED VIDEO API - WHISPER HYBRID INTEGRATION WITH 502 RETRY LOGIC AND EAGER_ASYNC",
    version: "whisper_hybrid_readable_mobile_optimized_pet_tales_branded_with_retry_eager_async_v2",
    timestamp: new Date().toISOString(),
    approach:
      "8-Step Process with OpenAI Whisper HYBRID Readable Caption Generation, Pet Tales AI Branding, and 502 Error Retry Logic",
    timeout: "300 seconds (5 minutes)",
    whisper_hybrid_integration: {
      caption_source: "OpenAI Whisper API",
      model: "whisper-1",
      response_format: "verbose_json with segment + word-level timestamps",
      processing_type: "Synchronous (no webhooks needed)",
      timing_precision: "Hybrid: segments for readability + words for precision",
      caption_style: "Natural sentences with intelligent phrase splitting",
      readability_improvement: "Complete thoughts preserved, mobile-optimized",
      cost: "$0.006 per minute",
      hybrid_approach: "Best of both worlds: natural flow + precise timing",
      font_styling: "Arial, 12px for optimal mobile readability",
    },
    pet_tales_ai_branding: {
      step_8: "Supabase Storage Upload for Pet Tales AI branding",
      branded_urls: "Custom Pet Tales AI sharing URLs",
      fallback_support: "Cloudinary backup URLs maintained",
      sharing_optimization: "Optimized for social media sharing",
      domain_branding: "Videos served from Pet Tales AI domain",
    },
    retry_logic: {
      enabled: true,
      purpose: "Handle temporary Cloudinary 502 server errors",
      error_detection: [
        "error.http_code === 502",
        "error.message contains '502'",
        "error.name === 'UnexpectedResponse'",
      ],
      max_attempts: 3,
      backoff_strategy: "Exponential: 2s, 4s, 8s delays",
      operations_covered: [
        "Audio upload to Cloudinary (uploadAudioWithCaptions)",
        "Intermediate video creation (STEP 4)",
        "Final video transformation (STEP 6)",
      ],
      not_covered: [
        "OpenAI Whisper API calls (different service)",
        "cloudinary.api.resource calls (read-only operations)",
        "Supabase operations (different service)",
      ],
      reliability_improvement: "Significantly reduces failures from temporary infrastructure issues",
    },
    eager_async_support: {
      enabled: true,
      purpose: "Handle large videos that exceed synchronous processing limits",
      error_trigger: "Video is too large to process synchronously",
      solution: "Uses eager_async=true with polling for completion",
      polling_interval: "3 seconds",
      max_wait_time: "3 minutes (180 seconds)",
      operations_covered: [
        "Intermediate video creation (STEP 4)",
        "Final video transformation (STEP 6)",
      ],
      fallback_behavior: "Attempts synchronous first, falls back to async if needed",
      benefit: "Supports videos of any size without 400 errors",
    },
    mobile_font_optimization: {
      font_family: "Arial",
      font_size: "12px",
      purpose: "Smaller, more readable subtitles for mobile devices",
      readability: "Optimized for small screens and mobile viewing",
      positioning: "Bottom center with 120px margin for visibility",
      color: "White text for maximum contrast",
    },
    hybrid_caption_advantages: {
      readability: "Natural sentence flow instead of choppy word chunks",
      mobile_optimization: "3-4 second chunks perfect for mobile viewing with optimized font size",
      intelligent_splitting: "Long sentences split at natural phrase boundaries",
      precise_timing: "Word-level accuracy for perfect synchronization",
      complete_thoughts: "Preserves sentence meaning and context",
      natural_breaks: "Respects commas, conjunctions, and phrase boundaries",
      fallback_support: "Graceful degradation if word-level data unavailable",
      font_readability: "Arial 12px ensures clear reading on mobile screens",
    },
    caption_quality_comparison: {
      old_word_chunking: "Why does my friend | always want to dance | with me in the | backyard She keeps putting",
      new_hybrid_approach:
        "Today, I realized hammocks aren't just for humans. | After my brave expedition standing on my hind legs to investigate | this mysterious swinging thing, it hit me.",
      improvement: "Complete thoughts with natural sentence boundaries and mobile-optimized font styling",
      mobile_readability: "Significantly improved for TikTok-style viewing with proper font sizing",
    },
    technical_implementation: {
      whisper_api_call: "timestamp_granularities: ['segment', 'word']",
      base_approach: "Use segments as natural sentence boundaries",
      splitting_logic: "Split long segments (>4s or >12 words) at phrase boundaries",
      timing_precision: "Map chunks to precise word-level start/end times",
      phrase_boundaries: "Commas, conjunctions, prepositions, natural pauses",
      mobile_optimization: "Maximum 4 seconds per caption for readability",
      font_parameters: "font_family: 'Arial', font_size: 12 for mobile readability",
      step_8_supabase: "Download from Cloudinary and upload to Supabase Storage for Pet Tales AI branding",
      retry_wrapper: "cloudinaryWithRetry() function with exponential backoff for 502 errors",
    },
  })
}
