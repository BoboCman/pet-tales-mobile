"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"
import type { Database } from "./database.types"

export async function uploadToStorage(file: File, bucket: string, path?: string): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  try {
    // Check file size - Supabase has a 50MB limit for standard uploads
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      console.error(`File size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit:`, file.size / (1024 * 1024), "MB")
      throw new Error(`File size exceeds ${MAX_SIZE / (1024 * 1024)}MB limit`)
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${uuidv4()}.${fileExt}`
    const filePath = path ? `${path}/${fileName}` : fileName

    // For larger files, we need to handle them in chunks
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      console.error("Error uploading file:", error)
      // Provide more specific error messages
      if (error.message.includes("413") || error.message.includes("too large")) {
        throw new Error(`File is too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB.`)
      }
      throw error
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    return data.publicUrl
  } catch (error) {
    console.error("Error in uploadToStorage:", error)
    throw error
  }
}

export async function uploadPetAvatar(file: File): Promise<string | null> {
  return uploadToStorage(file, "pet-avatars")
}

export async function uploadPetPhoto(file: File): Promise<string | null> {
  return uploadToStorage(file, "pet-photos")
}

export async function uploadPetVideo(file: File): Promise<string | null> {
  return uploadToStorage(file, "pet-videos")
}

export async function uploadPetVoice(file: File): Promise<string | null> {
  return uploadToStorage(file, "pet-voices")
}
