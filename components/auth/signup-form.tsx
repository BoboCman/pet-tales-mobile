"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { AuthHeader, CheckRow, PasswordInput, authInputClass } from "@/components/auth/auth-ui"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { LEGAL_VERSIONS } from "@/lib/constants/legal"

const signupSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "Please confirm you're 18 or older and accept the Terms",
  }),

  marketingOptIn: z.boolean().optional(),
})

type SignupFormValues = z.infer<typeof signupSchema>

interface SignupFormProps {
  redirectTo?: string
}

export function SignupForm({ redirectTo }: SignupFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      agreeToTerms: false,
      marketingOptIn: false,
    },
  })

  const onSubmit = async (data: SignupFormValues) => {
    try {
      setIsLoading(true)

      const consentTimestamp = new Date().toISOString()

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            // Editable later in Settings
            username: data.email.split("@")[0],
            agree_to_terms: data.agreeToTerms,
            terms_accepted_at: consentTimestamp,
            terms_version: LEGAL_VERSIONS.TERMS_VERSION,
            privacy_version: LEGAL_VERSIONS.PRIVACY_VERSION,
            // Copied to users.marketing_opt_in by the signup trigger
            marketing_opt_in: data.marketingOptIn === true,
          },
        },
      })

      if (error) {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      if (authData.user) {
        try {
          await supabase.from("consent_logs").insert({
            email: data.email,
            timestamp: consentTimestamp,
            consent_text: "I'm 18 or older and agree to the Terms of Service and Privacy Policy",
            has_explicit_agreement: true,
            terms_version: LEGAL_VERSIONS.TERMS_VERSION,
            action_type: "signup_consent",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
            is_valid: true,
          })
        } catch (consentError) {
          // Log error but don't block signup
          console.error("[v0] Consent log failed:", consentError)
        }
      }

      // Welcome email (sent once per account; never blocks signup)
      if (authData.session) {
        await fetch("/api/email/welcome", { method: "POST", keepalive: true }).catch(() => {})
      }

      toast({
        title: "Account created!",
        description: "Welcome to Pet Tale AI. Let's create some amazing pet videos!",
      })

      // New users go straight to making their first tale
      const redirectUrl = redirectTo || "/dashboard/reels/new?from=signup"
      window.location.href = redirectUrl
    } catch (error: any) {
      toast({
        title: "Signup error",
        description: "There was a problem creating your account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const agreed = form.watch("agreeToTerms")
  const termsError = form.formState.errors.agreeToTerms?.message

  return (
    <div className="w-full">
      <AuthHeader
        backHref={redirectTo || "/"}
        title="Give your pet a voice"
        subtitle="Create your account. Your first tale is free."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="you@example.com"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    className={authInputClass}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="At least 8 characters" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2 pt-1">
            <CheckRow
              checked={agreed}
              invalid={!!termsError}
              onChange={(v) => form.setValue("agreeToTerms", v, { shouldValidate: form.formState.isSubmitted })}
            >
              I&apos;m 18 or older and agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-400"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-400"
              >
                Privacy Policy
              </Link>
            </CheckRow>
            {termsError && <p className="pl-8 text-sm text-red-600">{termsError}</p>}
            <CheckRow
              checked={form.watch("marketingOptIn") === true}
              onChange={(v) => form.setValue("marketingOptIn", v)}
            >
              Send me tips, new voices and occasional offers. Unsubscribe anytime.
            </CheckRow>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-xl bg-teal-600 text-base font-semibold hover:bg-teal-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href={redirectTo ? `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/auth/login"}
          className="font-semibold text-teal-700 dark:text-teal-400"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
