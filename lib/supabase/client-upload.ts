"use client"

import { v4 as uuidv4 } from "uuid"
import { useSupabase } from "./provider"
import { createClient } from "@/lib/supabase/client"

// Export the useClientUpload hook
export const useClientUpload = () => {
  const { supabase } = useSupabase()

  const uploadToStorage = async (
    file: File,
    bucket: string,
    onProgress?: (progress: number) => void,
  ): Promise<string | null> => {
    try {
      // Check file size - Updated to 75MB limit to match desktop
      const MAX_SIZE = 75 * 1024 * 1024 // 75MB
      if (file.size > MAX_SIZE) {
        console.error(`File size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit:`, file.size / (1024 * 1024), "MB")
        throw new Error(`File size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit`)
      }

      const fileExt = file.name.split(".").pop()
      const fileName = `${uuidv4()}.${fileExt}`
      console.log(`Uploading file to ${bucket}/${fileName}`)

      // Upload file with progress tracking
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
        onUploadProgress: (progress) => {
          if (onProgress) {
            const percent = Math.round((progress.loaded / progress.total) * 100)
            onProgress(percent)
          }
        },
      })

      if (error) {
        console.error("Error uploading file:", error)
        throw error
      }

      console.log(`File uploaded successfully: ${fileName}`)

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
      console.log(`Public URL:`, urlData.publicUrl)

      return urlData.publicUrl
    } catch (error) {
      console.error("Error in uploadToStorage:", error)
      throw error
    }
  }

  const uploadPetAvatar = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    return uploadToStorage(file, "pet-avatars", onProgress)
  }

  const uploadPetPhoto = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    return uploadToStorage(file, "pet-photo", onProgress)
  }

  const uploadVideo = async (file: File, onProgress?: (progress: number) => void): Promise<string | null> => {
    return uploadToStorage(file, "videos", onProgress)
  }

  return {
    uploadToStorage,
    uploadPetAvatar,
    uploadPetPhoto,
    uploadVideo,
  }
}

// Additional standalone function for direct video uploads
export async function uploadVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ path: string; url: string }> {
  const supabase = createClient()

  try {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `videos/${fileName}`

    const { data, error } = await supabase.storage.from("videos").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (progress) => {
        const percentage = (progress.loaded / progress.total) * 100
        onProgress?.(percentage)
      },
    })

    if (error) {
      throw error
    }

    const { data: urlData } = supabase.storage.from("videos").getPublicUrl(data.path)

    return {
      path: data.path,
      url: urlData.publicUrl,
    }
  } catch (error) {
    console.error("Error uploading video:", error)
    throw new Error("Failed to upload video")
  }
}
