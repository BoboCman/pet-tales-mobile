"use client"

import type React from "react"
import { Fragment, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Heart, Play, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { togglePublicLikeClient } from "@/lib/api/engagement"
import { getSessionId, hasLikedTale, toggleTaleLike } from "@/lib/session/client-session"
import { PetAvatar, TalePoster, talePosterUrl } from "@/components/reels/tale-poster"
import { cn } from "@/lib/utils"

interface PublicTale {
  id: string
  title: string | null
  mood: string | null
  created_at: string
  view_count: number | null
  like_count: number | null
  pets: {
    id: string
    name: string
    type: string | null
    avatar_url: string | null
    photo_url: string | null
    image_url: string | null
  } | null
}

type Filter = "latest" | "loved" | "dog" | "cat"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "loved", label: "Most loved" },
  { id: "dog", label: "🐶 Dogs" },
  { id: "cat", label: "🐱 Cats" },
]

const petImageOf = (pets: PublicTale["pets"]) =>
  [pets?.image_url, pets?.avatar_url, pets?.photo_url].find((u) => typeof u === "string" && u.startsWith("http")) ??
  null

function CommunityCard({ tale }: { tale: PublicTale }) {
  const [likes, setLikes] = useState(tale.like_count || 0)
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)
  const petName = tale.pets?.name || "A pet"

  useEffect(() => setLiked(hasLikedTale(tale.id)), [tale.id])
  useEffect(() => setLikes(tale.like_count || 0), [tale.like_count])

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const next = !liked
    const before = likes
    setLiked(next)
    setLikes(next ? before + 1 : Math.max(0, before - 1))
    toggleTaleLike(tale.id)
    try {
      const result = await togglePublicLikeClient(tale.id, getSessionId())
      if (result.success && result.likeCount !== undefined) setLikes(result.likeCount)
      else throw new Error("like failed")
    } catch {
      setLiked(!next)
      setLikes(before)
      toggleTaleLike(tale.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Link
      href={`/community/public/${tale.id}`}
      className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gray-200 shadow-sm transition-transform active:scale-[0.98]"
    >
      <TalePoster tale={{ posterUrl: talePosterUrl(tale.id), petName }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

      <span className="absolute left-2 top-2 flex max-w-[65%] items-center gap-1.5 rounded-full bg-black/35 py-0.5 pl-0.5 pr-2 text-xs font-medium text-white backdrop-blur-sm">
        <PetAvatar name={petName} image={petImageOf(tale.pets)} className="h-5 w-5" />
        <span className="truncate">{petName}</span>
      </span>

      <button
        type="button"
        onClick={toggleLike}
        aria-label={liked ? `Unlike ${tale.title || "this tale"}` : `Like ${tale.title || "this tale"}`}
        className="absolute right-1.5 top-1.5 flex h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-black/35 px-2 text-xs font-semibold text-white backdrop-blur-sm active:scale-95"
      >
        <Heart className={cn("h-4 w-4 transition-colors", liked && "fill-rose-500 text-rose-500")} />
        {likes > 0 && <span>{likes}</span>}
      </button>

      <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
        <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
      </span>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{tale.title || "A pet tale"}</p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-white/75">
          {tale.mood && <span className="truncate">{tale.mood}</span>}
          {(tale.view_count || 0) > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              {tale.mood && <span className="mr-1">·</span>}
              <Eye className="h-3 w-3" />
              {tale.view_count}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}

function JoinCard() {
  return (
    <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-teal-50 p-4 sm:col-span-3 lg:col-span-4 dark:bg-teal-900/30">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-600 dark:bg-gray-900">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-white">Give your pet a voice</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Your first tale is free.</p>
      </div>
      <Link
        href="/auth/signup?ref=community"
        className="inline-flex h-10 shrink-0 items-center rounded-full bg-teal-600 px-4 text-sm font-semibold text-white active:bg-teal-700"
      >
        Try it
      </Link>
    </div>
  )
}

export default function CommunityPublicPageClient() {
  const [tales, setTales] = useState<PublicTale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null)
  const [filter, setFilter] = useState<Filter>("latest")

  const fetchTales = async () => {
    try {
      const response = await fetch("/api/public-tales")
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setTales(Array.isArray(data) ? data : Array.isArray(data?.tales) ? data.tales : [])
      setError(false)
    } catch (err) {
      console.error("Community: could not load tales", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTales()
    createClient()
      .auth.getSession()
      .then(({ data }) => setIsSignedIn(!!data.session))
      .catch(() => setIsSignedIn(false))
  }, [])

  // Fresh like and view counts when coming back to the page
  useEffect(() => {
    const onVisible = () => !document.hidden && fetchTales()
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const hasDogs = tales.some((t) => t.pets?.type === "dog")
  const hasCats = tales.some((t) => t.pets?.type === "cat")
  const filters = FILTERS.filter((f) => (f.id === "dog" || f.id === "cat" ? hasDogs && hasCats : true))

  const shown = useMemo(() => {
    if (filter === "loved") return [...tales].sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    if (filter === "dog" || filter === "cat") return tales.filter((t) => t.pets?.type === filter)
    return tales
  }, [tales, filter])

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-white pb-28 dark:bg-gray-950">
      {/* Title row */}
      <div className="flex items-end justify-between gap-3 px-4 pt-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Community</h1>
          <p className="mt-0.5 text-sm text-gray-500">Tales shared by pet families</p>
        </div>
        {isSignedIn === false && (
          <Link
            href="/auth/signup?ref=community"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm active:bg-teal-700"
          >
            <Sparkles className="h-4 w-4" />
            Try it free
          </Link>
        )}
      </div>

      {/* Filters */}
      {tales.length > 1 && (
        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-gray-900 dark:text-white">We couldn&apos;t load the tales</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                fetchTales()
              }}
              className="mt-4 inline-flex h-10 items-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 active:bg-gray-50"
            >
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-gray-900 dark:text-white">No tales here yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Share one of yours from its tale page to see it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((tale, i) => (
              <Fragment key={tale.id}>
                <CommunityCard tale={tale} />
                {isSignedIn === false && i === 5 && <JoinCard />}
              </Fragment>
            ))}
            {isSignedIn === false && shown.length <= 5 && <JoinCard />}
          </div>
        )}
      </div>
    </div>
  )
}
