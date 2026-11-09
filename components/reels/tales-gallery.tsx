"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { Eye, Globe, Heart, MoreHorizontal, Play, Plus, Trash2 } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useToast } from "@/hooks/use-toast"
import { deleteReel } from "@/app/actions/reel-actions"
import { cn } from "@/lib/utils"

export interface GalleryTale {
  id: string
  title: string
  mood: string | null
  createdAt: string
  isPublic: boolean
  views: number
  likes: number
  petId: string | null
  petName: string
  petImage: string | null
  videoUrl: string | null
  posterUrl: string | null
}

export interface TaleInProgress {
  id: string
  title: string | null
  createdAt: string
  petName: string | null
}

const ago = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

// Soft gradients for tales with no poster yet, picked per pet so the grid stays varied
const FALLBACK_GRADIENTS = [
  "from-teal-500 to-emerald-700",
  "from-amber-400 to-orange-600",
  "from-sky-500 to-indigo-700",
  "from-rose-400 to-fuchsia-700",
  "from-lime-500 to-green-700",
  "from-violet-500 to-purple-800",
]

/**
 * Poster frame of a finished tale, or a gradient when there is none yet. Never loads the video:
 * a grid of video previews downloads every tale and makes the page sluggish. Older tales get a
 * poster the first time they are opened (see PosterBackfill).
 */
function TalePoster({ tale }: { tale: GalleryTale }) {
  const [failed, setFailed] = useState(!tale.posterUrl)
  const imgRef = useRef<HTMLImageElement>(null)
  // A poster that failed before hydration never fires onError in React, so check once mounted
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  if (!failed) {
    return (
      <img
        ref={imgRef}
        src={tale.posterUrl!}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }
  const seed = [...(tale.petName || "pet")].reduce((n, c) => n + c.charCodeAt(0), 0)
  return (
    <div className={cn("absolute inset-0 bg-gradient-to-br", FALLBACK_GRADIENTS[seed % FALLBACK_GRADIENTS.length])} />
  )
}

function PetAvatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-[10px] font-bold text-teal-700",
        className,
      )}
    >
      {image && !broken ? (
        <img src={image} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  )
}

export function TalesGallery({ tales, inProgress }: { tales: GalleryTale[]; inProgress: TaleInProgress[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [petFilter, setPetFilter] = useState<string>("all")
  const [menuTale, setMenuTale] = useState<GalleryTale | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // While a tale is being made, check back every 15s so it appears here the moment it's ready
  useEffect(() => {
    if (inProgress.length === 0) return
    const timer = setInterval(() => router.refresh(), 15000)
    return () => clearInterval(timer)
  }, [inProgress.length, router])

  const pets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image: string | null; count: number }>()
    for (const t of tales) {
      if (!t.petId) continue
      const p = map.get(t.petId) ?? { id: t.petId, name: t.petName, image: t.petImage, count: 0 }
      p.count++
      map.set(t.petId, p)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [tales])

  const shown = petFilter === "all" ? tales : tales.filter((t) => t.petId === petFilter)

  const closeMenu = () => {
    setMenuTale(null)
    setConfirmDelete(false)
  }

  const handleDelete = async () => {
    if (!menuTale) return
    setDeleting(true)
    try {
      const result = await deleteReel(menuTale.id)
      if (!result.success) throw new Error(result.error || "Couldn't delete this tale")
      toast({ title: "Tale deleted" })
      closeMenu()
      router.refresh()
    } catch (error) {
      toast({
        title: "Couldn't delete this tale",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Title row */}
      <div className="flex items-end justify-between gap-3 px-4 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">My tales</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tales.length} {tales.length === 1 ? "tale" : "tales"}
            {pets.length > 1 ? ` · ${pets.length} pets` : ""}
          </p>
        </div>
        <Link
          href="/dashboard/reels/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm active:bg-teal-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New tale
        </Link>
      </div>

      {/* Pet filter */}
      {pets.length > 1 && (
        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "all", name: "All", image: null as string | null, count: tales.length }, ...pets].map((p) => {
            const active = petFilter === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPetFilter(p.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-medium transition-colors",
                  p.id === "all" && "pl-3.5",
                  active
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
                )}
              >
                {p.id !== "all" && <PetAvatar name={p.name} image={p.image} className="h-6 w-6" />}
                {p.name}
                <span className={cn("text-xs", active ? "text-teal-100" : "text-gray-400")}>{p.count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="px-4 pb-8 pt-4">
        {/* Tales still being made */}
        {inProgress.length > 0 && (
          <div className="mb-4 space-y-2">
            {inProgress.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-3 dark:border-teal-900 dark:bg-teal-900/20"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-900">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">
                    {t.title || (t.petName ? `${t.petName}'s new tale` : "Your new tale")}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Being made · usually ready in 2 to 3 minutes
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid of finished tales */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((tale) => (
            <div key={tale.id} className="relative">
              <Link
                href={`/dashboard/reels/${tale.id}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gray-200 shadow-sm active:scale-[0.98] transition-transform"
              >
                <TalePoster tale={tale} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

                {/* Pet */}
                <span className="absolute left-2 top-2 flex max-w-[70%] items-center gap-1.5 rounded-full bg-black/35 py-0.5 pl-0.5 pr-2 text-xs font-medium text-white backdrop-blur-sm">
                  <PetAvatar name={tale.petName} image={tale.petImage} className="h-5 w-5" />
                  <span className="truncate">{tale.petName}</span>
                </span>

                {/* Play */}
                <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                  <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                </span>

                {/* Title + meta */}
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{tale.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-white/75">
                    {tale.isPublic ? (
                      <>
                        <Globe className="h-3 w-3 shrink-0" />
                        <span>Shared</span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          {tale.views}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Heart className="h-3 w-3" />
                          {tale.likes}
                        </span>
                      </>
                    ) : (
                      <span className="truncate">{tale.mood || ago(tale.createdAt)}</span>
                    )}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setMenuTale(tale)}
                aria-label={`More options for ${tale.title}`}
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm active:bg-black/50"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tale actions sheet */}
      <Drawer open={!!menuTale} onOpenChange={(open) => !open && closeMenu()} shouldScaleBackground={false}>
        <DrawerContent>
          {menuTale && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="line-clamp-1">{menuTale.title}</DrawerTitle>
                <DrawerDescription>
                  {menuTale.petName} · {ago(menuTale.createdAt)}
                  {menuTale.isPublic
                    ? ` · Shared to Community: ${menuTale.views} views, ${menuTale.likes} likes`
                    : " · Private"}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {!confirmDelete ? (
                  <>
                    <Link
                      href={`/dashboard/reels/${menuTale.id}`}
                      onClick={closeMenu}
                      className="flex h-12 items-center gap-3 rounded-xl bg-gray-50 px-4 font-medium text-gray-900 active:bg-gray-100 dark:bg-gray-800 dark:text-white"
                    >
                      <Play className="h-5 w-5 text-teal-600" />
                      Watch and share
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex h-12 w-full items-center gap-3 rounded-xl bg-gray-50 px-4 font-medium text-red-600 active:bg-red-50 dark:bg-gray-800"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete tale
                    </button>
                  </>
                ) : (
                  <>
                    <p className="px-1 pb-1 text-sm text-gray-600 dark:text-gray-400">
                      Delete this tale for good? This can&apos;t be undone.
                    </p>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-red-600 font-semibold text-white active:bg-red-700 disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Delete tale"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-gray-100 font-medium text-gray-900 active:bg-gray-200 dark:bg-gray-800 dark:text-white"
                    >
                      Keep it
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
