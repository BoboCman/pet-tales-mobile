"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Check, ChevronRight, Pause, Play } from "lucide-react"
import type { VoicePersonality } from "@/lib/voice-personalities"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

// Short sample of each voice, played from the picker
const VOICE_PREVIEW_URLS: Record<string, string> = {
  baby_innocent: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Baby%20Talk-NQk3ZA5dH37rkloLRTJq77mDklxZzx.mp3",
  british_narrator:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/British%20Narrator-n5Ags8xA4GTdiZtA8Yx2jwwOdR95QR.mp3",
  sassy_adult:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Sassy%20%26%20Sarcastic-RqQPhSPC57Af0hT4iSfW4YB7YjYEKr.mp3",
  hyper_enthusiast:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Super%20Excited-qaPl6iWPwj3GgGKRe8XNYldPm8OKrJ.mp3",
  chill_swag:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Island%20Storyteller-6a8kHpkNFk1doXRMXFchH2rMWx5HtH.mp3",
  southern_belle:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Southern%20Belle-2h3StLTH8ukPOGqaDIAxKhpBFw9LCh.mp3",
  sweet_pea: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Sweat%20Pea-FuCiWa8gJBz16C90NNRsAjijjVSpCW.mp3",
  tough_guy: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Tough%20Guy-eDHjJ60iLDiOQ4QHCKrnzouJROMf0A.mp3",
  gentle_giant:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gentle%20Giant-2yd3uO3mUdDwclUYDYY8lsPyxF4v92.mp3",
  grandma_storyteller:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Grandma%20Storyteller-inuGOsCzzg5qTxfL1rWzIrwU6umTaF.mp3",
  irish_lass: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Irish%20Lass-lLTPmDbpAmTRfcKxmWYyCWa8E2N3oI.mp3",
  grandpa_storyteller:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Grandpa%20Storyteller-xrKEUKkI0Ppzuc4AR2xNhNvhlIvS2p.mp3",
}

interface VoicePickerProps {
  voices: VoicePersonality[]
  selectedVoice: string
  onSelectVoice: (voiceValue: string) => void
}

/**
 * The chosen voice as one tappable row; tapping opens a bottom sheet with every voice in a plain
 * vertical list (scrolls like any phone list, no sideways carousel). Tap a row to pick it,
 * tap ▶ to hear it first.
 */
export function VoicePicker({ voices, selectedVoice, onSelectVoice }: VoicePickerProps) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const current = voices.find((v) => v.value === selectedVoice)

  const stopAudio = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlaying(null)
    setLoading(null)
  }

  // Never leave a sample playing after the sheet closes or the page changes
  useEffect(() => {
    if (!open) stopAudio()
  }, [open])
  useEffect(() => stopAudio, [])

  const togglePreview = (voice: VoicePersonality, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = VOICE_PREVIEW_URLS[voice.value]
    if (!url) return
    if (playing === voice.value || loading === voice.value) {
      stopAudio()
      return
    }
    stopAudio()
    const audio = new Audio(url)
    audioRef.current = audio
    setLoading(voice.value)
    audio.addEventListener("playing", () => {
      if (audioRef.current !== audio) return
      setLoading(null)
      setPlaying(voice.value)
    })
    audio.addEventListener("ended", () => audioRef.current === audio && stopAudio())
    audio.addEventListener("error", () => audioRef.current === audio && stopAudio())
    // play() straight from the tap, so iOS allows the sound
    audio.play().catch(() => audioRef.current === audio && stopAudio())
  }

  const choose = (voice: VoicePersonality) => {
    onSelectVoice(voice.value)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-3 text-left active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-2xl dark:bg-teal-900/30">
          {current?.emoji ?? "🎙️"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900 dark:text-white">{current?.label ?? "Pick a voice"}</span>
          <span className="block truncate text-sm text-gray-500">{current?.description}</span>
        </span>
        <span className="flex shrink-0 items-center text-sm font-medium text-teal-700">
          Change <ChevronRight className="h-4 w-4" />
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Pick a voice</DrawerTitle>
            <DrawerDescription>Tap ▶ to hear it, tap the voice to use it.</DrawerDescription>
          </DrawerHeader>
          <ul
            className="overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            data-vaul-no-drag
          >
            {voices.map((voice) => {
              const isSelected = voice.value === selectedVoice
              const isPlaying = playing === voice.value
              const isLoading = loading === voice.value
              return (
                <li key={voice.value} className="py-1">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => choose(voice)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && choose(voice)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors",
                      isSelected
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30"
                        : "border-transparent bg-gray-50 active:bg-gray-100 dark:bg-gray-800",
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl dark:bg-gray-900">
                      {voice.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                        {voice.label}
                        {isSelected && <Check className="h-4 w-4 text-teal-600" strokeWidth={3} />}
                      </span>
                      <span className="line-clamp-2 text-sm text-gray-500">{voice.description}</span>
                    </span>
                    {VOICE_PREVIEW_URLS[voice.value] && (
                      <button
                        type="button"
                        onClick={(e) => togglePreview(voice, e)}
                        aria-label={isPlaying ? `Stop ${voice.label} sample` : `Play ${voice.label} sample`}
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                          isPlaying || isLoading ? "bg-teal-600 text-white" : "bg-white text-teal-700 shadow-sm dark:bg-gray-900",
                        )}
                      >
                        {isLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="ml-0.5 h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  )
}
