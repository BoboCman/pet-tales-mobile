"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

type SupabaseContext = {
  supabase: SupabaseClient<Database>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [supabase] = useState(() =>
    createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
  )
  const router = useRouter()

  useEffect(() => {
    // Refresh server components only when the signed-in user actually changes. Supabase also fires
    // INITIAL_SESSION on every load, TOKEN_REFRESHED hourly and SIGNED_IN again whenever the app
    // returns to the foreground; refreshing on those queued a full server render that held up
    // the next tap on the bottom nav.
    let userId: string | null | undefined
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user?.id ?? null
      const changed = userId !== undefined && next !== userId
      userId = next
      if (changed) router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  return (
    <Context.Provider value={{ supabase }}>
      <div className="min-h-screen flex flex-col">{children}</div>
    </Context.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useSupabase must be used inside SupabaseProvider")
  }

  return context
}

// Named export so you can do: import { SupabaseProvider } from "@/lib/supabase/provider"
export { SupabaseProvider }
