"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/**
 * Second step of the admin sign-in: a 6-digit code from an authenticator app
 * (Microsoft Authenticator, Google Authenticator, 1Password...).
 * The first visit sets the app up with a QR code; later visits only ask for the code.
 */

type Mode = "loading" | "enroll" | "verify" | "error"

export default function AdminMfaPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("loading")
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function start() {
      const supabase = createClient()

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === "aal2") {
        router.replace("/admin/dashboard")
        return
      }

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) {
        if (!cancelled) {
          setError("Couldn't load your two-factor settings. Refresh to try again.")
          setMode("error")
        }
        return
      }

      const verified = factors?.totp?.[0]
      if (verified) {
        if (!cancelled) {
          setFactorId(verified.id)
          setMode("verify")
        }
        return
      }

      // First time: clear any half-finished setup, then start a new one
      for (const f of factors?.all ?? []) {
        if (f.factor_type === "totp" && f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pet Tale Admin",
        issuer: "Pet Tale",
      })
      if (cancelled) return
      if (enrollError || !enrolled) {
        setError("Couldn't start two-factor setup. In Supabase, check Authentication > Multi-Factor has TOTP enabled.")
        setMode("error")
        return
      }
      const qr = enrolled.totp.qr_code
      setFactorId(enrolled.id)
      setQrCode(qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${qr}`)
      setSecret(enrolled.totp.secret)
      setMode("enroll")
    }
    start()
    return () => {
      cancelled = true
    }
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId) return
    setError("")
    setBusy(true)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (verifyError) {
      setError("That code didn't work. Codes change every 30 seconds, so enter the newest one.")
      setBusy(false)
      return
    }
    router.replace("/admin/dashboard")
    router.refresh()
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    router.replace("/admin/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md border-teal-200 dark:border-teal-800">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {mode === "enroll" ? "Set up two-factor login" : "Enter your code"}
          </CardTitle>
          <CardDescription className="text-center">
            {mode === "enroll"
              ? "Open your authenticator app, add an account, and scan this code."
              : "Open your authenticator app and enter the 6-digit code for Pet Tale."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "loading" && <p className="text-center text-sm text-gray-500">Loading…</p>}

          {mode === "enroll" && qrCode && (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR code for your authenticator app" className="h-48 w-48 rounded-lg bg-white p-2" />
              {secret && (
                <button
                  type="button"
                  className="text-xs text-teal-700 underline"
                  onClick={() => setShowSecret((v) => !v)}
                >
                  {showSecret ? secret : "Can't scan? Show the setup key"}
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {(mode === "enroll" || mode === "verify") && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                  disabled={busy}
                  className="text-center text-lg tracking-[0.4em]"
                />
              </div>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={busy || code.length !== 6}>
                {busy ? "Checking…" : mode === "enroll" ? "Turn on and continue" : "Continue"}
              </Button>
            </form>
          )}

          <button type="button" onClick={signOut} className="block w-full text-center text-sm text-gray-500 hover:text-gray-700">
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
