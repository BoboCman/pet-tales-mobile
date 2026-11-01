"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { createClient } from "@/lib/supabase/client"
import { Search, PawPrint, Video, Settings, CreditCard, Users, Home } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface Pet {
  id: string
  name: string
  type: string
  image_url: string | null
}

interface Tale {
  id: string
  title: string
  created_at: string
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pets, setPets] = useState<Pet[]>([])
  const [tales, setTales] = useState<Tale[]>([])
  const [search, setSearch] = useState("")
  const supabase = createClient()

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Fetch user's pets and tales when opening
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  const fetchData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Fetch pets
    const { data: petsData } = await supabase
      .from("pets")
      .select("id, name, type, image_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (petsData) setPets(petsData)

    // Fetch recent tales
    const { data: talesData } = await supabase
      .from("reels")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (talesData) setTales(talesData)
  }

  const handleSelect = useCallback((callback: () => void) => {
    setOpen(false)
    callback()
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden">
        <Command className="rounded-lg border-0 shadow-none" shouldFilter={true}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search or type a command..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="p-2">
              <Command.Item
                onSelect={() => handleSelect(() => router.push("/pricing"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <CreditCard className="h-4 w-4 text-teal-600" />
                <span>Buy Credits</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>B
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push("/dashboard/settings"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings className="h-4 w-4 text-teal-600" />
                <span>Settings</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>,
                </kbd>
              </Command.Item>
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigation" className="p-2">
              <Command.Item
                onSelect={() => handleSelect(() => router.push("/"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push("/dashboard/pets"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <PawPrint className="h-4 w-4" />
                <span>My Pets</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push("/dashboard/reels"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Video className="h-4 w-4" />
                <span>My Tales</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => router.push("/community/public"))}
                className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Users className="h-4 w-4" />
                <span>Community</span>
              </Command.Item>
            </Command.Group>

            {/* My Pets */}
            {pets.length > 0 && (
              <Command.Group heading="My Pets" className="p-2">
                {pets.map((pet) => (
                  <Command.Item
                    key={pet.id}
                    onSelect={() => handleSelect(() => router.push(`/dashboard/pets/${pet.id}`))}
                    className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/30 text-sm">
                      {pet.type.toLowerCase().includes("dog") ? "🐶" : "🐱"}
                    </div>
                    <span>{pet.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground capitalize">{pet.type}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Recent Tales */}
            {tales.length > 0 && (
              <Command.Group heading="Recent Tales" className="p-2">
                {tales.map((tale) => (
                  <Command.Item
                    key={tale.id}
                    onSelect={() => handleSelect(() => router.push(`/dashboard/reels/${tale.id}`))}
                    className="flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Video className="h-4 w-4 text-gray-400" />
                    <span>{tale.title || "Untitled Tale"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(tale.created_at).toLocaleDateString()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
