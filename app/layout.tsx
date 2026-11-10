import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { SupabaseProvider } from "@/lib/supabase/provider"
import { CreditsProvider } from "@/components/providers/credits-provider"
import { KeyboardShortcutsProvider } from "@/components/providers/keyboard-shortcuts-provider"
import "./globals.css"
import { BottomNav } from "@/components/layout/bottom-nav"
import { DesktopNav } from "@/components/layout/desktop-nav"
import { CommandPalette } from "@/components/layout/command-palette"
import { Analytics } from "@vercel/analytics/react"
import { InstallPrompt } from "@/components/layout/install-prompt"
import { StructuredData } from "@/components/structured-data"

const inter = Inter({ subsets: ["latin"] })

const siteUrl = "https://www.pettaleai.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pet Tale AI - Give Your Pet a Voice with AI Narration",
    template: "%s | Pet Tale AI",
  },
  description:
    "Transform pet videos into shareable stories with AI voice narration and perfectly timed captions. Upload any pet video, get a ready-to-share story in minutes. Free to start.",
  keywords: [
    "AI pet video",
    "pet video narrator",
    "talking pet video",
    "add voice to pet video",
    "pet video captions",
    "AI voice over pets",
    "make my dog talk",
    "make my cat talk",
    "pet video app",
    "funny pet videos",
    "pet story creator",
  ],
  authors: [{ name: "Glendale AI, LLC" }],
  creator: "Glendale AI, LLC",
  publisher: "Glendale AI, LLC",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Pet Tale AI",
    title: "Pet Tale AI - Give Your Pet a Voice with AI Narration",
    description:
      "Transform pet videos into shareable stories with AI voice narration and perfectly timed captions. Free to start.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Pet Tale AI - AI-powered pet video narration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pet Tale AI - Give Your Pet a Voice",
    description: "Transform pet videos into shareable stories with AI voice narration and captions. Free to start.",
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  manifest: "/manifest.json",
    generator: 'v0.app'
}

// viewport-fit=cover makes the safe-area insets real on iPhones, so the bottom nav sits above
// the home indicator in the installed app instead of under it (where taps start a swipe)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#14b8a6" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StructuredData />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pet Tale AI" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <SupabaseProvider>
          <CreditsProvider>
            <KeyboardShortcutsProvider>
              <div className="min-h-screen flex flex-col">
                <DesktopNav />
                <main className="flex-1 md:pb-0">{children}</main>
                <BottomNav />
              </div>
              <Toaster />
              <CommandPalette />
            </KeyboardShortcutsProvider>
          </CreditsProvider>
        </SupabaseProvider>
        <Analytics />
        <InstallPrompt />
      </body>
    </html>
  )
}
