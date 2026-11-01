"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function SignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="w-full sm:w-auto bg-transparent"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isSigningOut ? "Signing Out..." : "Sign Out"}
    </Button>
  )
}
