"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Zap, CreditCard, Settings, ChevronDown } from "lucide-react"

export function QuickActionsMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleAction = (path: string) => {
    setOpen(false)
    router.push(path)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-teal-200 hover:border-teal-300 hover:bg-teal-50 bg-transparent"
        >
          <Zap className="h-4 w-4 text-teal-600" />
          <span className="hidden sm:inline">Quick Actions</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleAction("/pricing")} className="cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4 text-teal-600" />
          <span>Buy Credits</span>
          <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleAction("/dashboard/settings")} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
