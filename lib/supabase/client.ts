"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export const createClient = () => {
  // Return existing client if already created
  if (supabaseClient) {
    return supabaseClient
  }

  // Create new client only if none exists
  supabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return supabaseClient
}

// Connection retry configuration for mobile networks
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
}

export const createClientSupabaseClient = () => {
  return createClient()
}

export const createBrowserSupabaseClient = () => {
  return createClient()
}

// Legacy compatibility
export const createSupabaseClient = () => {
  return createClient()
}

// Reset client instance (useful for testing or logout)
export const resetClient = () => {
  if (supabaseClient) {
    supabaseClient.removeAllChannels()
  }
  supabaseClient = null
}

// Memory management for mobile devices
export const cleanupClient = () => {
  if (supabaseClient) {
    // Close realtime connections
    supabaseClient.removeAllChannels()
    supabaseClient = null
  }
}

export { createBrowserClient }

// Export default
export default createClient
