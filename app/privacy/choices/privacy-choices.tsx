"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Check, ShieldCheck } from "lucide-react"
import { setAdsOptOut } from "@/lib/meta/client"
import { ADS_OPT_OUT_COOKIE } from "@/lib/meta/shared"

/**
 * "Do Not Sell or Share My Personal Information" in plain words. One switch that turns off ad
 * tracking (the ad pixel and the server copies of its events) on this browser.
 */
export function PrivacyChoices() {
  const [optedOut, setOptedOut] = useState<boolean | null>(null)
  const [gpc, setGpc] = useState(false)

  useEffect(() => {
    setGpc((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true)
    setOptedOut(document.cookie.split(/;\s*/).includes(`${ADS_OPT_OUT_COOKIE}=1`))
  }, [])

  const choose = (optOut: boolean) => {
    setAdsOptOut(optOut)
    setOptedOut(optOut)
    // Reload so the ad pixel is unloaded (or loaded) everywhere at once
    window.setTimeout(() => window.location.reload(), 400)
  }

  const off = gpc || optedOut === true

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900 md:pb-0">
      <div className="border-b bg-white dark:bg-gray-950">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Privacy Policy
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Your privacy choices</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          We use ad partners, like social media platforms, to show Pet Tale to people who&apos;d enjoy it and to see which ads work.
          Some privacy laws call this &ldquo;sharing&rdquo; your information. You can turn it off here anytime.
        </p>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-800">
          <div className="flex items-start gap-3">
            <ShieldCheck className={`mt-0.5 h-6 w-6 shrink-0 ${off ? "text-teal-600" : "text-gray-400"}`} />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {optedOut === null ? "Checking…" : off ? "Ad tracking is off" : "Ad tracking is on"}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {gpc
                  ? "Your browser sends a Global Privacy Control signal, so we already treat you as opted out."
                  : off
                    ? "We won't share your visits, signup or purchases with ad partners from this browser."
                    : "Turning it off stops sharing from this browser. If you use other browsers or devices, turn it off there too."}
              </p>
            </div>
          </div>

          {!gpc && optedOut !== null && (
            <button
              type="button"
              onClick={() => choose(!optedOut)}
              className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors ${
                optedOut
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white"
                  : "bg-teal-600 text-white hover:bg-teal-700"
              }`}
            >
              {optedOut ? "Turn ad tracking back on" : (
                <>
                  <Check className="h-4 w-4" />
                  Turn off ad tracking
                </>
              )}
            </button>
          )}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          This doesn&apos;t change the emails you get or how Pet Tale works. Questions? Email{" "}
          <a className="font-medium text-teal-700 underline underline-offset-2" href="mailto:pettaleai@gmail.com">
            pettaleai@gmail.com
          </a>
          .
        </p>
      </article>
    </div>
  )
}
