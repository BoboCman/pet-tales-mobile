"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { LogOut, Loader2 } from "lucide-react"

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      setIsLoading(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        toast({
          title: "Error signing out",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      })

      router.push("/")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleSignOut} variant="destructive" className="w-full" disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing out...
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </>
      )}
    </Button>
  )
}
