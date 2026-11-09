"use client"

import { useEffect, useRef, useState } from "react"
import { Headphones, Loader2, Pause, Play } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { VOICE_PREVIEW_URLS } from "@/lib/voice-samples"
import { cn } from "@/lib/utils"

export type SheetItem = { value: string; emoji: string; label: string; description: string }

/** "Hear the voices" button on the home page: a sheet to play every voice sample and read the vibes. */
export function VoicesVibesSheet({ voices, vibes }: { voices: SheetItem[]; vibes: SheetItem[] }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"voices" | "vibes">("voices")
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(null)
    setLoading(null)
  }

  useEffect(() => {
    if (!open) stop()
  }, [open])
  useEffect(() => stop, [])

  const toggle = (value: string) => {
    const url = VOICE_PREVIEW_URLS[value]
    if (!url) return
    if (playing === value || loading === value) return stop()
    stop()
    const audio = new Audio(url)
    audioRef.current = audio
    setLoading(value)
    audio.addEventListener("playing", () => {
      if (audioRef.current !== audio) return
      setLoading(null)
      setPlaying(value)
    })
    audio.addEventListener("ended", () => audioRef.current === audio && stop())
    audio.addEventListener("error", () => audioRef.current === audio && stop())
    // play() straight from the tap, so iOS allows the sound
    audio.play().catch(() => audioRef.current === audio && stop())
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-800 active:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
      >
        <Headphones className="h-4 w-4" />
        Hear the voices
      </button>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Voices and vibes</DrawerTitle>
            <DrawerDescription>
              The voice is who&apos;s talking. The vibe is how they tell it. Mix any two.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
              {(["voices", "vibes"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    stop()
                    setTab(t)
                  }}
                  className={cn(
                    "h-9 rounded-full text-sm font-semibold",
                    tab === t ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white" : "text-gray-500",
                  )}
                >
                  {t === "voices" ? `${voices.length} voices` : `${vibes.length} vibes`}
                </button>
              ))}
            </div>
          </div>

          <ul
            className="mt-3 space-y-2 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            data-vaul-no-drag
          >
            {(tab === "voices" ? voices : vibes).map((item) => {
              const isPlaying = playing === item.value
              const isLoading = loading === item.value
              const canPlay = tab === "voices" && !!VOICE_PREVIEW_URLS[item.value]
              const Row = canPlay ? "button" : "div"
              return (
                <li key={item.value}>
                  <Row
                    {...(canPlay ? { type: "button" as const, onClick: () => toggle(item.value) } : {})}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl p-3 text-left",
                      isPlaying ? "bg-teal-50 dark:bg-teal-900/30" : "bg-gray-50 dark:bg-gray-800",
                      canPlay && "active:bg-gray-100",
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl dark:bg-gray-900">
                      {item.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900 dark:text-white">{item.label}</span>
                      <span className="line-clamp-2 text-sm text-gray-500">{item.description}</span>
                    </span>
                    {canPlay && (
                      <span
                        aria-label={isPlaying ? `Stop ${item.label}` : `Play ${item.label}`}
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          isPlaying ? "bg-teal-600 text-white" : "bg-white text-teal-700 dark:bg-gray-900",
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-4 w-4" fill="currentColor" />
                        ) : (
                          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
                        )}
                      </span>
                    )}
                  </Row>
                </li>
              )
            })}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  )
}
