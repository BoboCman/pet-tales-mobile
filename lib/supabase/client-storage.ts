"use client"

import { v4 as uuidv4 } from "uuid"
import { useSupabase } from "./provider"
import { clientLogger } from "@/lib/client-logger"
import { createClient } from "@supabase/supabase-js"

export function useDirectUpload() {
  const { supabase } = useSupabase()

  const uploadToStorage = async (
    file: File,
    bucket: string,
    onProgress?: (progress: number) => void,
  ): Promise<string | null> => {
    try {
      // Check file size - 75MB limit
      const MAX_SIZE = 75 * 1024 * 1024 // 75MB
      if (file.size > MAX_SIZE) {
        const sizeMB = file.size / (1024 * 1024)
        const maxSizeMB = MAX_SIZE / (1024 * 1024)
        clientLogger.error("Storage", `File size exceeds ${maxSizeMB}MB limit`, { fileSizeMB: sizeMB })
        throw new Error(`File size exceeds ${maxSizeMB}MB limit`)
      }

      const fileExt = file.name.split(".").pop()
      const fileName = `${uuidv4()}.${fileExt}`

      clientLogger.info("Storage", "Starting file upload to storage")
      clientLogger.dev("Storage", "Upload details", {
        bucket,
        fileName,
        fileSize: file.size,
        fileType: file.type,
      })

      // Upload file with progress tracking
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
        onUploadProgress: (progress) => {
          if (onProgress) {
            const percent = Math.round((progress.loaded / progress.total) * 100)
            onProgress(percent)
            clientLogger.progress("Storage", "Upload progress", percent)
          }
        },
      })

      if (error) {
        clientLogger.error("Storage", "Upload failed", error)
        throw error
      }

      clientLogger.success("Storage", "File uploaded successfully")
      clientLogger.dev("Storage", "Upload result", { path: data.path })

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
      clientLogger.dev("Storage", "Public URL generated", { hasUrl: !!urlData.publicUrl })

      return urlData.publicUrl
    } catch (error) {
      clientLogger.error("Storage", "Error in uploadToStorage", error)
      throw error
    }
  }

  const uploadPetVideo = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    clientLogger.info("Storage", "Starting pet video upload")
    return uploadToStorage(file, "pet-videos", onProgress)
  }

  const uploadPetAvatar = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    clientLogger.info("Storage", "Starting pet avatar upload")
    return uploadToStorage(file, "pet-avatars", onProgress)
  }

  const uploadPetPhoto = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    clientLogger.info("Storage", "Starting pet photo upload")
    return uploadToStorage(file, "pet-photo", onProgress)
  }

  return {
    uploadToStorage,
    uploadPetVideo,
    uploadPetAvatar,
    uploadPetPhoto,
  }
}

/**
 * Stand-alone helper to upload an audio file to Supabase Storage.
 *
 * - Uses the `pet-voices` bucket
 * - Enforces the same 75 MB limit as other uploads
 * - Returns the public URL or `null` on failure
 */
export async function uploadAudioToSupabase(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string | null> {
  // --- guard rails ---------------------------------------------------------
  const MAX_SIZE = 75 * 1024 * 1024 // 75 MB
  if (file.size > MAX_SIZE) {
    throw new Error(`Audio file is too large. Maximum allowed size is ${MAX_SIZE / 1024 / 1024} MB.`)
  }

  // --- initialise a (browser-side) Supabase client -------------------------
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  const supabase = createClient(supabaseUrl, anonKey)

  // --- upload ---------------------------------------------------------------
  const fileExt = file.name.split(".").pop() || "mp3"
  const fileName = `pet-voice-${crypto.randomUUID()}.${fileExt}`

  // NOTE: the browser SDK doesn't expose granular progress events – we emit
  // 0 % at the start and 100 % after success for basic UX feedback.
  onProgress?.(0)

  const { data, error } = await supabase.storage
    .from("pet-voices")
    .upload(fileName, file, { cacheControl: "3600", upsert: true })

  if (error) {
    throw error
  }

  onProgress?.(100)

  const {
    data: { publicUrl },
  } = supabase.storage.from("pet-voices").getPublicUrl(data.path)

  return publicUrl || null
}
