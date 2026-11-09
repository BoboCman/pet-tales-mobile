"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PawPrint } from "lucide-react"
import { CreditsBadge } from "@/components/ui/credits-badge"

// Pages with their own compact top bar (back + title + tales), so the app header isn't stacked on top
const OWN_HEADER = ["/dashboard/reels/new"]

export function DashboardMobileHeader() {
  const pathname = usePathname()
  if (pathname && OWN_HEADER.includes(pathname)) return null
  return (
    <div className="bg-white p-4 border-b md:hidden">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <PawPrint className="h-6 w-6 text-teal-600" />
          <span className="font-bold text-xl text-gray-900">Pet Tale</span>
        </Link>
        <CreditsBadge />
      </div>
    </div>
  )
}
