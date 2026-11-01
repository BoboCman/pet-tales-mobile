"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import type { VoicePersonality } from "@/lib/voice-personalities"
import { Play, Pause, Volume2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceSelectorProps {
  voices: VoicePersonality[]
  selectedVoice: string
  onSelectVoice: (voiceValue: string) => void
}

// Map voice values to audio preview URLs
const VOICE_PREVIEW_URLS: Record<string, string> = {
  baby_innocent: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Baby%20Talk-NQk3ZA5dH37rkloLRTJq77mDklxZzx.mp3",
  british_narrator: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/British%20Narrator-n5Ags8xA4GTdiZtA8Yx2jwwOdR95QR.mp3",
  sassy_adult: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Sassy%20%26%20Sarcastic-RqQPhSPC57Af0hT4iSfW4YB7YjYEKr.mp3",
  hyper_enthusiast: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Super%20Excited-qaPl6iWPwj3GgGKRe8XNYldPm8OKrJ.mp3",
  chill_swag: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Island%20Storyteller-6a8kHpkNFk1doXRMXFchH2rMWx5HtH.mp3",
  southern_belle: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Southern%20Belle-2h3StLTH8ukPOGqaDIAxKhpBFw9LCh.mp3",
  sweet_pea: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Sweat%20Pea-FuCiWa8gJBz16C90NNRsAjijjVSpCW.mp3",
  tough_guy: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Tough%20Guy-eDHjJ60iLDiOQ4QHCKrnzouJROMf0A.mp3",
  gentle_giant: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gentle%20Giant-2yd3uO3mUdDwclUYDYY8lsPyxF4v92.mp3",
  grandma_storyteller: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Grandma%20Storyteller-inuGOsCzzg5qTxfL1rWzIrwU6umTaF.mp3",
  irish_lass: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Irish%20Lass-lLTPmDbpAmTRfcKxmWYyCWa8E2N3oI.mp3",
  grandpa_storyteller: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Grandpa%20Storyteller-xrKEUKkI0Ppzuc4AR2xNhNvhlIvS2p.mp3",
}

export function VoiceSelector({ voices, selectedVoice, onSelectVoice }: VoiceSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          left: 40,
          behavior: "smooth",
        })
        setTimeout(() => {
          scrollContainerRef.current?.scrollTo({
            left: 0,
            behavior: "smooth",
          })
        }, 500)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current && scrollContainerRef.current.scrollLeft > 10) {
        setShowScrollHint(false)
      }
    }

    const container = scrollContainerRef.current
    container?.addEventListener("scroll", handleScroll)
    return () => container?.removeEventListener("scroll", handleScroll)
  }, [])

  const handlePlayVoice = async (voice: VoicePersonality, e: React.MouseEvent) => {
    e.stopPropagation()

    const audioUrl = VOICE_PREVIEW_URLS[voice.value]

    if (!audioUrl) {
      console.log("[v0] No audio preview available for", voice.value)
      return
    }

    // If already playing this voice, pause it
    if (playingVoice === voice.value && audioRef.current) {
      audioRef.current.pause()
      setPlayingVoice(null)
      return
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // Play new audio
    setLoadingVoice(voice.value)
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener("canplaythrough", () => {
      setLoadingVoice(null)
      setPlayingVoice(voice.value)
      audio.play().catch((err) => {
        console.error("[v0] Audio play error:", err)
        setPlayingVoice(null)
        setLoadingVoice(null)
      })
    })

    audio.addEventListener("ended", () => {
      setPlayingVoice(null)
    })

    audio.addEventListener("error", () => {
      console.error("[v0] Audio load error for", voice.value)
      setLoadingVoice(null)
      setPlayingVoice(null)
    })

    audio.load()
  }

  const handleSelectVoice = (voice: VoicePersonality) => {
    onSelectVoice(voice.value)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-foreground">Pet's Voice</h3>
          <p className="text-sm text-muted-foreground">Tap any voice to hear a preview</p>
        </div>
        <Volume2 className="w-5 h-5 text-teal-600" />
      </div>

      {/* Horizontal scrollable voice gallery */}
      <div className="relative -mx-4 px-4">
        <div className="absolute right-0 top-0 bottom-2 w-16 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none z-10" />

        {showScrollHint && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none animate-bounce-horizontal">
            <div className="bg-teal-500 text-white rounded-full p-1.5 shadow-lg">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {voices.map((voice) => {
            const isSelected = selectedVoice === voice.value
            const isPlaying = playingVoice === voice.value
            const isLoading = loadingVoice === voice.value
            const hasPreview = !!VOICE_PREVIEW_URLS[voice.value]

            return (
              <div key={voice.value} className="flex-shrink-0 snap-start first:ml-0">
                <div
                  className={cn(
                    "relative w-[120px] h-[140px] rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-3 gap-2",
                    isSelected
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-lg shadow-teal-500/20"
                      : isPlaying
                        ? "border-teal-400 bg-teal-100 dark:bg-teal-900/50"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 active:scale-95",
                  )}
                  onClick={() => handleSelectVoice(voice)}
                >
                  {/* Emoji at top */}
                  <div className="text-4xl">{voice.emoji}</div>

                  {/* Voice name */}
                  <div className="text-center">
                    <div className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                      {voice.label}
                    </div>
                  </div>

                  {/* Play button - only show if preview available */}
                  {hasPreview && (
                    <button
                      onClick={(e) => handlePlayVoice(voice, e)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
                        isPlaying
                          ? "bg-teal-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600",
                      )}
                      aria-label={isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                  )}

                  {/* Playing indicator - animated waveform */}
                  {isPlaying && (
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5">
                      <div className="w-1 bg-teal-600 rounded-full animate-wave-1" style={{ height: "8px" }} />
                      <div className="w-1 bg-teal-600 rounded-full animate-wave-2" style={{ height: "12px" }} />
                      <div className="w-1 bg-teal-600 rounded-full animate-wave-3" style={{ height: "8px" }} />
                    </div>
                  )}

                  {/* Selection checkmark badge */}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Hide scrollbar CSS - add to globals.css if needed
const style = document.createElement("style")
style.textContent = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  @keyframes wave-1 {
    0%, 100% { height: 8px; }
    50% { height: 16px; }
  }
  
  @keyframes wave-2 {
    0%, 100% { height: 12px; }
    50% { height: 20px; }
  }
  
  @keyframes wave-3 {
    0%, 100% { height: 8px; }
    50% { height: 16px; }
  }
  
  .animate-wave-1 {
    animation: wave-1 0.6s ease-in-out infinite;
  }
  
  .animate-wave-2 {
    animation: wave-2 0.6s ease-in-out infinite 0.1s;
  }
  
  .animate-wave-3 {
    animation: wave-3 0.6s ease-in-out infinite 0.2s;
  }
  
  @keyframes bounce-horizontal {
    0%, 100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(-8px);
    }
  }
  
  .animate-bounce-horizontal {
    animation: bounce-horizontal 1.5s ease-in-out infinite;
  }
`
if (typeof document !== "undefined" && !document.getElementById("voice-selector-styles")) {
  style.id = "voice-selector-styles"
  document.head.appendChild(style)
}
