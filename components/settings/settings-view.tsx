"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronRight, Download, FileText, KeyRound, LifeBuoy, LogOut, Mail, Shield } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ProfileForm } from "@/components/settings/profile-form"
import { ChangePasswordForm } from "@/components/settings/change-password-form"
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog"
import { createClient } from "@/lib/supabase/client"
import { getPlanById, priceSummary, type PackOffer } from "@/lib/pricing-config"
import { SEO_CONFIG } from "@/lib/constants/seo"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface BillingData {
  free_credits: number | null
  purchased_credits: number | null
  subscription_tier: string | null
  subscription_status: string | null
  subscription_period_end: string | null
  subscription_cancel_at_period_end: boolean | null
}

const SUPPORT = SEO_CONFIG.contactEmail

const mailto = (subject: string, body: string) =>
  `mailto:${SUPPORT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      {title && <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-gray-800 dark:bg-gray-900">
        {children}
      </div>
    </section>
  )
}

type RowProps = {
  icon: typeof Mail
  label: string
  value?: string
  href?: string
  onClick?: () => void
  tone?: "default" | "danger"
  chevron?: boolean
}

function Row({ icon: Icon, label, value, href, onClick, tone = "default", chevron = true }: RowProps) {
  const inner = (
    <>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          tone === "danger"
            ? "bg-red-50 text-red-600 dark:bg-red-900/30"
            : "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={cn(
          "flex-1 text-left font-medium",
          tone === "danger" ? "text-red-600" : "text-gray-900 dark:text-white",
        )}
      >
        {label}
      </span>
      {value && <span className="max-w-[45%] truncate text-sm text-gray-500">{value}</span>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
    </>
  )
  const cls = "flex min-h-[52px] w-full items-center gap-3 px-4 py-2 active:bg-gray-50 dark:active:bg-gray-800"
  if (href?.startsWith("/"))
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    )
  if (href)
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    )
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

function PlanCard({ billing, pack }: { billing: BillingData | null; pack: PackOffer | null }) {
  const { toast } = useToast()
  const [opening, setOpening] = useState(false)

  const status = billing?.subscription_status ?? null
  // past_due still has a live Stripe subscription: the person needs the portal to fix their card
  const hasPlan = status === "active" || status === "trialing" || status === "past_due"
  const plan = hasPlan && billing?.subscription_tier ? getPlanById(billing.subscription_tier) : undefined
  const packTales = billing?.purchased_credits || 0
  const total = (billing?.free_credits || 0) + packTales
  const periodEnd = formatDate(billing?.subscription_period_end ?? null)
  const cancelling = !!billing?.subscription_cancel_at_period_end

  const openPortal = async () => {
    setOpening(true)
    try {
      const res = await fetch("/api/stripe/billing-portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.message || "Couldn't open billing")
      window.location.href = data.url
    } catch (error) {
      toast({
        title: "Couldn't open billing",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setOpening(false)
    }
  }

  let detail: string
  if (plan && cancelling) detail = `${plan.name} · ends ${periodEnd ?? "this period"}`
  else if (plan) detail = `${plan.name}${periodEnd && status !== "past_due" ? ` · renews ${periodEnd}` : ""}`
  else detail = priceSummary(pack)

  return (
    <section id="billing" className="mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold", total === 0 ? "text-gray-900 dark:text-white" : "text-teal-600")}>
              {total}
            </span>
            <span className="text-gray-500">{total === 1 ? "tale" : "tales"} left</span>
          </p>
          <p className="mt-0.5 text-sm text-gray-500">{detail}</p>
        </div>
        {plan ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={opening}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-gray-200 px-4 text-sm font-semibold text-gray-800 active:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-100"
          >
            {opening ? "Opening…" : "Manage"}
          </button>
        ) : (
          <Link
            href="/pricing"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white active:bg-teal-700"
          >
            {pack ? "Get tales" : "See plans"}
          </Link>
        )}
      </div>

      {plan && status === "past_due" && (
        <button
          type="button"
          onClick={openPortal}
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-left text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          Your last payment didn&apos;t go through. Tap to update your card.
        </button>
      )}

      {(packTales > 0 || plan) && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800">
          {packTales > 0 && `${packTales} of these are pack tales that never expire. `}
          {plan && !cancelling && "Unused plan tales roll over, up to two months' worth."}
          {plan && cancelling && "You can keep using your tales until then, or renew in Manage."}
        </p>
      )}
    </section>
  )
}

export function SettingsView({
  user,
  billing,
  pack = null,
}: {
  user: any
  billing: BillingData | null
  pack?: PackOffer | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [sheet, setSheet] = useState<"profile" | "password" | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const email: string = user?.email ?? ""
  const username: string = user?.user_metadata?.username || email.split("@")[0] || "You"
  const fullName: string | undefined = user?.user_metadata?.full_name || undefined
  const displayName = fullName || username

  const signOut = async () => {
    setSigningOut(true)
    await createClient().auth.signOut()
    router.push("/")
    router.refresh()
  }

  const deleteAccount = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return data.error || "Something went wrong. Please try again."
      await createClient()
        .auth.signOut()
        .catch(() => {})
      toast({ title: "Your account has been deleted", description: "We've sent a confirmation email. Take care!" })
      window.location.href = "/"
      return null
    } catch {
      return "Something went wrong. Please try again."
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-gray-50 px-4 pb-28 pt-5 dark:bg-gray-950">
      <h1 className="px-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Settings</h1>

      {/* Profile */}
      <button
        type="button"
        onClick={() => setSheet("profile")}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-gray-900 dark:text-white">{displayName}</span>
          <span className="block truncate text-sm text-gray-500">{email}</span>
        </span>
        <span className="text-sm font-medium text-teal-700 dark:text-teal-400">Edit</span>
      </button>

      <PlanCard billing={billing} pack={pack} />

      <Section title="Account">
        <Row icon={KeyRound} label="Change password" onClick={() => setSheet("password")} />
        <Row
          icon={Mail}
          label="Change login email"
          href={mailto(
            "Change my login email",
            `Hi Pet Tale AI team,\n\nPlease change my login email.\n\nCurrent email: ${email}\nNew email: \n\nThank you!`,
          )}
        />
      </Section>

      <Section title="Help and privacy">
        <Row
          icon={LifeBuoy}
          label="Contact support"
          href={mailto("Help with Pet Tale", `Hi Pet Tale AI team,\n\n\n\nAccount email: ${email}`)}
        />
        <Row
          icon={Download}
          label="Request my data"
          href={mailto(
            "Data export request",
            `Hi Pet Tale AI team,\n\nPlease send me a copy of my data (account, pets, tales and purchases).\n\nAccount email: ${email}\n\nThank you!`,
          )}
        />
        <Row icon={Shield} label="Privacy policy" href="/privacy" />
        <Row icon={Shield} label="Your privacy choices" href="/privacy/choices" />
        <Row icon={FileText} label="Terms of service" href="/terms" />
      </Section>

      <Section>
        <Row icon={LogOut} label={signingOut ? "Signing out…" : "Sign out"} onClick={signOut} chevron={false} />
      </Section>

      <div className="mt-6 text-center">
        <DeleteAccountDialog
          title="Delete your account?"
          triggerLabel="Delete account"
          confirmLabel="Delete my account"
          onConfirm={deleteAccount}
          trigger={
            <button type="button" className="h-11 px-4 text-sm font-medium text-red-600 active:opacity-70">
              Delete account
            </button>
          }
          description={
            <>
              <p>This can&apos;t be undone. It deletes your account, your pets and your private tales right away.</p>
              <p>Any plan is cancelled now, with no refund for the current month, and unused tales are lost.</p>
              <p>Tales you made public stay up at their links. Email us if you want any of those removed.</p>
            </>
          }
        />
        
      </div>

      <Sheet
        open={sheet === "profile"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Edit profile"
        description={email}
      >
        <ProfileForm user={user} onSaved={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === "password"} onOpenChange={(o) => !o && setSheet(null)} title="Change password">
        <ChangePasswordForm onDone={() => setSheet(null)} />
      </Sheet>
    </div>
  )
}
