"use client"

import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft, Eye, EyeOff, PawPrint } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Shared header for sign up / sign in: back arrow, brand mark, title and one line. */
export function AuthHeader({ backHref, title, subtitle }: { backHref: string; title: string; subtitle: ReactNode }) {
  return (
    <div>
      <Link
        href={backHref}
        aria-label="Back"
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-600 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800"
      >
        <ChevronLeft className="h-6 w-6" />
      </Link>
      <span className="mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-900/30">
        <PawPrint className="h-6 w-6 text-teal-600" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
      <p className="mt-1 text-gray-500">{subtitle}</p>
    </div>
  )
}

export const authInputClass = "h-12 rounded-xl text-base"

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof Input>>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false)
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn(authInputClass, "pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-gray-400"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    )
  },
)

/** Tappable consent row: a small round-cornered check plus its label; the whole row toggles. */
export function CheckRow({
  checked,
  onChange,
  children,
  invalid,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
  invalid?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-gray-300 accent-teal-600",
          invalid && "outline outline-2 outline-red-400",
        )}
      />
      <span className="text-sm leading-snug text-gray-600 dark:text-gray-300">{children}</span>
    </label>
  )
}
