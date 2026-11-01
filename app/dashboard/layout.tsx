import type { ReactNode } from "react"
import Link from "next/link"
import { PawPrint } from "lucide-react"
import { CreditsBadge } from "@/components/ui/credits-badge"

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-white p-4 border-b md:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <PawPrint className="h-6 w-6 text-teal-600" />
            <span className="font-bold text-xl text-gray-900">Pet Tale</span>
          </Link>
          <CreditsBadge />
        </div>
      </div>

      <main className="flex-1 bg-white">{children}</main>
    </div>
  )
}
