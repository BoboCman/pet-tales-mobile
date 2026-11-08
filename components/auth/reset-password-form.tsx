"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

/** Second half of "forgot password": the email link signs the person in, then they pick a new password. */
export function ResetPasswordForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [supabase] = useState(() => createClient())
  const [status, setStatus] = useState<"checking" | "ready" | "no_session">("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? "ready" : "no_session")
    })
    // Older links put the session in the URL hash; the client picks it up and fires this
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setStatus("ready")
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError("Use at least 8 characters.")
    if (password !== confirm) return setError("The two passwords don't match.")
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setSaving(false)
      setError(
        /different from the old/i.test(updateError.message)
          ? "Please choose a password you haven't used here before."
          : updateError.message,
      )
      return
    }
    toast({ title: "Password updated", description: "You're signed in. Welcome back!" })
    router.replace("/dashboard/pets")
    router.refresh()
  }

  if (status === "checking") {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    )
  }

  if (status === "no_session") {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>This link has expired</CardTitle>
          <CardDescription>
            Reset links work once and expire after an hour. Ask for a new one and use the newest email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full h-12 bg-teal-600 hover:bg-teal-700">
            <Link href="/auth/forgot-password">Send me a new link</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>At least 8 characters. You'll stay signed in after saving.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Type it again</Label>
            <Input
              id="confirm-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={saving} className="w-full h-12 bg-teal-600 hover:bg-teal-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save new password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
