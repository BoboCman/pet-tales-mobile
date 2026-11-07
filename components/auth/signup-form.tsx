"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ChevronLeft, Loader2 } from "lucide-react"
import { LEGAL_VERSIONS } from "@/lib/constants/legal"

const signupSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and dashes")
    .optional()
    .or(z.literal("")),
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
      username: "",
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
            username: data.username || data.email.split("@")[0],
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

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-3 pb-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href={redirectTo || "/"}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <CardTitle className="text-2xl sm:text-xl font-semibold text-center leading-tight">
          Create your account
        </CardTitle>
        <CardDescription className="text-base sm:text-sm text-center leading-relaxed px-2">
          <div className="text-teal-600 font-medium">Enter your email and password to get started with Pet Tale AI</div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your@email.com"
                      type="email"
                      autoComplete="email"
                      className="h-12 text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium">Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="••••••••"
                      type="password"
                      autoComplete="new-password"
                      className="h-12 text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Must be at least 8 characters</FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium">Username (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="johndoe"
                      autoComplete="username"
                      className="h-12 text-base"
                      {...field}
                      onChange={(e) => {
                        const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                        field.onChange(cleaned)
                      }}
                    />
                  </FormControl>
                  <FormDescription>Display name for your profile (defaults to email if not provided)</FormDescription>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-1"
                        aria-describedby="terms-description"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal cursor-pointer" htmlFor="agreeToTerms">
                        I&apos;m 18 or older and agree to the{" "}
                        <Link
                          href="/terms"
                          className="underline underline-offset-4 hover:text-primary font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          className="underline underline-offset-4 hover:text-primary font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Privacy Policy
                        </Link>
                      </FormLabel>
                    </div>
                  </div>
                  <FormMessage className="text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="marketingOptIn"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value === true} onCheckedChange={field.onChange} className="mt-1" />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer leading-snug">
                    Send me tips, new voices and occasional offers. Unsubscribe anytime.
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isLoading || !form.watch("agreeToTerms")}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-center justify-center space-y-4 pt-6">
        <div className="text-base sm:text-sm text-muted-foreground text-center leading-relaxed">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline underline-offset-4 hover:text-primary font-medium">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
