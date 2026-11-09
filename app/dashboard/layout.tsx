import type { ReactNode } from "react"
import { DashboardMobileHeader } from "@/components/layout/dashboard-mobile-header"

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <DashboardMobileHeader />

      <main className="flex-1 bg-white">{children}</main>
    </div>
  )
}
