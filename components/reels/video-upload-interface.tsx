"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { useSupabase } from "@/lib/supabase/provider"
import { useDirectUpload } from "@/lib/supabase/client-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Upload, Loader2, Check, Sparkles, Plus, Play, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { clientLogger } from "@/lib/client-logger"
import { CREDIT_MESSAGES } from "@/lib/types/credit-types"
import { OutOfCreditsBanner } from "@/components/ui/out-of-credits-banner"
import { OutOfCreditsModal } from "@/components/modals/out-of-credits-modal"
import type { PackOffer } from "@/lib/pricing-config"
import Link from "next/link"
import { getVoicesByPetType } from "@/lib/voice-personalities"
import { NARRATION_GENRES } from "@/lib/narration-genres"
import { useToast } from "@/hooks/use-toast" // the store the app's <Toaster /> shows
import { VoicePicker } from "./voice-picker-sheet"
import { PetBasicsFields, newPetDefaults, type PetBasicsValues } from "@/components/pets/pet-basics"
import { readClipInfo, checkClip, friendlyUploadError, reportUploadFailure, type ClipInfo } from "@/lib/video/clip-check"

interface Pet {
  id: string
  name: string
  type: string
  breed: string | null
  gender: string
  pet_age: string | null
  image_url: string | null
  personality_energy: number | null
  personality_sociability: number | null
  personality_confidence: number | null
  personality_obedience: number | null
  personality_play_style: number | null
  personality_curiosity: number | null
  personality_territorial: number | null
}

interface VideoUploadInterfaceProps {
  pets: Pet[]
  selectedPetId: string
  /** The one-time pack on sale, offered when the person runs out of tales */
  pack?: PackOffer | null
}

/** "0:27" style length for the clip card */
const formatClipLength = (seconds: number | null): string | null => {
  if (!seconds || !Number.isFinite(seconds)) return null
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Numbered section heading: tells a first-time user there are three quick picks, in order */
function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-6 w-6 shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
        {n}
      </span>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {hint && <span className="text-sm text-gray-500">{hint}</span>}
    </div>
  )
}

// Get pet emoji based on pet type
const getPetEmoji = (petType: string): string => {
  const type = petType.toLowerCase()
  if (type.includes("dog")) return "🐶"
  if (type.includes("cat")) return "🐱"
  return "🐾"
}

const getPersonalityLabel = (trait: string, value: number | null): string => {
  if (!value || value < 1 || value > 5) return ""

  const personalityLabels: Record<string, string[]> = {
    energy: ["Zen Master", "Couch Potato", "Balanced", "Peppy", "Zoomies!"],
    sociability: ["Lone Wolf", "Selective Socializer", "Friendly", "Party Animal", "Velcro Pet"],
    confidence: ["Shy Bean", "Cautious Paws", "Steady", "Brave", "Fearless Leader"],
    obedience: ["Free Spirit", "Negotiator", "Tries Their Best", "Rule Follower", "Teacher's Pet"],
    playStyle: ["Chess Master", "Gentle Player", "Playful", "Bouncy", "Wild Child"],
    curiosity: ["Unbothered", "Occasionally Interested", "Inquisitive", "Inspector", "Trouble Finder"],
    territorial: ["Sharing is Caring", "Easy-Going", "Mine Sometimes", "Protector", "Guardian Supreme"],
  }

  return personalityLabels[trait]?.[value - 1] || ""
}

const getTopPersonalityTraits = (pet: Pet): string => {
  const traits = [
    { name: "obedience", value: pet.personality_obedience },
    { name: "playStyle", value: pet.personality_play_style },
    { name: "energy", value: pet.personality_energy },
    { name: "sociability", value: pet.personality_sociability },
  ]

  // Filter out null values and sort by value (descending)
  const validTraits = traits.filter((t) => t.value !== null).sort((a, b) => (b.value || 0) - (a.value || 0))

  // Get top 2 traits
  const topTraits = validTraits.slice(0, 2).map((t) => getPersonalityLabel(t.name, t.value))

  return topTraits.filter(Boolean).join(" • ") || "Unique Personality"
}

export function VideoUploadInterface({ pets, selectedPetId, pack = null }: VideoUploadInterfaceProps) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { uploadPetVideo, uploadPetPhoto } = useDirectUpload()
  const { toast } = useToast() // Declare useToast

  // Refs for file inputs
  const recordInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [petId, setPetId] = useState(selectedPetId)
  // Defaults match the backend defaults in /api/video/upload, so a user can
  // create a first tale without making any choices.
  const [narrationStyle, setNarrationStyle] = useState("british_narrator")
  const [narrationGenre, setNarrationGenre] = useState("comedy")
  const [isAddingPet, setIsAddingPet] = useState(pets.length === 0)
  const [quickPet, setQuickPet] = useState<PetBasicsValues>({ name: "", type: "dog", gender: "male", photo: null })
  const [createdPet, setCreatedPet] = useState<Pet | null>(null)
  const [clipSeconds, setClipSeconds] = useState<number | null>(null)
  const [clipInfo, setClipInfo] = useState<ClipInfo | null>(null)
  const [showClipPlayer, setShowClipPlayer] = useState(false)
  const [mode, setMode] = useState<"select" | "upload" | "camera" | "preview">("select")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>("idle")
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isOutOfCredits, setIsOutOfCredits] = useState(false)
  const [isCheckingCredits, setIsCheckingCredits] = useState(false)
  const [showOutOfCreditsModal, setShowOutOfCreditsModal] = useState(false)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)

  const selectedPet = isAddingPet ? createdPet : pets.find((pet) => pet.id === petId) || createdPet

  const availableVoices = getVoicesByPetType(selectedPet?.type || quickPet.type)

  // All voices now work for all pets, so no validation required

  const checkCreditBalance = async () => {
    try {
      setIsCheckingCredits(true)
      const result = await preflightBalanceCheck()
      setCreditBalance(result.balance)
      const outOfCredits = !result.ok && result.code === "OUT_OF_CREDITS"
      setIsOutOfCredits(outOfCredits)

      if (outOfCredits) {
        console.log("ooc_banner_shown", {
          balance: result.balance,
        })
      }

      return result
    } catch (error) {
      console.error("Error checking credit balance:", error)
      return { ok: false, balance: 0, code: "SERVER_ERROR", message: "Unable to check credits" }
    } finally {
      setIsCheckingCredits(false)
    }
  }

  useEffect(() => {
    checkCreditBalance()
  }, [])

  useEffect(() => {
    const handleCreditsUpdated = (event: CustomEvent) => {
      const { balance: newBalance } = event.detail
      setCreditBalance(newBalance)
      setIsOutOfCredits(newBalance === 0)
    }

    window.addEventListener("creditsUpdated", handleCreditsUpdated as EventListener)
    return () => {
      window.removeEventListener("creditsUpdated", handleCreditsUpdated as EventListener)
    }
  }, [])

  // Cleanup video preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [videoPreviewUrl])

  // Scroll to top when mode changes
  useEffect(() => {
    if (mode !== "select") {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }, 100)
    }
  }, [mode])

  const handleFileSelection = async (file: File) => {
    if (!file) return

    // Check the clip right away (format, size, length) so problems show up before Create
    const info = await readClipInfo(file)
    const problem = checkClip(file, info)
    if (problem) {
      toast({ title: problem.title, description: problem.tip, variant: "destructive", duration: 10000 })
      reportUploadFailure({ stage: "picked", reason: problem.reason, file, info })
      return
    }
    setClipInfo(info)

    setSelectedFile(file)

    // Create preview URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(previewUrl)
    setClipSeconds(null)
    setMode("preview")

    clientLogger.info("DataUpload", "Video file selected for preview")
    clientLogger.dev("DataUpload", "File details", {
      name: file.name,
      size: file.size,
      type: file.type,
    })
  }

  // Creates the pet from the quick form (name, dog/cat, boy/girl) the first
  // time it's needed. Reuses it on retry so we never create duplicates.
  const ensurePet = async (userId: string): Promise<Pet> => {
    if (!isAddingPet && selectedPet) return selectedPet
    if (createdPet) return createdPet
    // The photo is a nice-to-have here: if it fails, the tale still goes ahead
    let image_url: string | null = null
    if (quickPet.photo) image_url = await uploadPetPhoto(quickPet.photo).catch(() => null)
    const { data, error } = await supabase
      .from("pets")
      .insert({ ...newPetDefaults(quickPet), image_url, user_id: userId })
      .select()
      .single()
    if (error || !data) {
      clientLogger.error("DataUpload", "Quick pet creation failed", error)
      throw new Error("Couldn't save your pet. Please try again.")
    }
    setCreatedPet(data as Pet)
    return data as Pet
  }

  const handleVideoUpload = async () => {
    if (!selectedFile || (!selectedPet && !(isAddingPet && quickPet.name.trim()))) {
      toast({
        title: "Error",
        description: "Please select a pet and video file",
        variant: "destructive",
      })
      return
    }

    let failedStage = "preparing"
    const step = (name: typeof currentStep) => {
      failedStage = name
      setCurrentStep(name)
    }
    try {
      setIsUploading(true)
      setUploadProgress(0)
      step("preparing")

      clientLogger.info("DataUpload", "Starting video upload process")
      clientLogger.dev("DataUpload", "Upload details", {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        narrationStyle,
        narrationGenre,
      })

      step("checking_credits")
      const balanceCheck = await preflightBalanceCheck()

      if (!balanceCheck.ok) {
        if (balanceCheck.code === "OUT_OF_CREDITS") {
          setShowOutOfCreditsModal(true)
          toast({
            title: CREDIT_MESSAGES.OUT_OF_CREDITS,
            description: pack ? "Grab a pack or pick a plan to keep creating." : "Pick a plan to keep creating.",
            variant: "destructive",
          })
          setCreditBalance(balanceCheck.balance)
          setIsOutOfCredits(true)
          return
        } else if (balanceCheck.code === "AUTH_REQUIRED") {
          toast({
            title: "Authentication required",
            description: CREDIT_MESSAGES.AUTH_REQUIRED,
            variant: "destructive",
          })
          return
        } else {
          toast({
            title: "Error",
            description: balanceCheck.message || "Unable to check your tales. Please try again.",
            variant: "destructive",
          })
          return
        }
      }

      // Update credit balance state
      setCreditBalance(balanceCheck.balance)
      setIsOutOfCredits(false)

      step("checking_rate_limit")
      const rateLimitCheck = await checkUploadRateLimit()

      if (!rateLimitCheck.success) {
        toast({
          title: "Upload limit reached",
          description: rateLimitCheck.message,
          variant: "destructive",
        })
        return
      }

      clientLogger.info("DataUpload", "Rate limit check passed", {
        remaining: rateLimitCheck.remaining,
        limit: rateLimitCheck.limit,
      })

      // Get current user
      step("authenticating")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        clientLogger.error("DataUpload", "User not authenticated")
        throw new Error("User not authenticated")
      }

      const pet = await ensurePet(user.id)

      // Upload video to Supabase storage
      step("uploading_video")
      setUploadProgress(10)

      const videoUrl = await uploadPetVideo(selectedFile, (progress) => {
        const adjustedProgress = 10 + progress * 0.7 // 10-80% for upload
        setUploadProgress(adjustedProgress)
        clientLogger.progress("DataUpload", "Upload progress", adjustedProgress)
      })

      if (!videoUrl) {
        clientLogger.error("DataUpload", "Failed to upload video to storage")
        throw new Error("Failed to upload video")
      }

      clientLogger.success("DataUpload", "Video uploaded to storage successfully")
      setUploadProgress(80)

      // Prepare webhook payload
      step("processing")
      clientLogger.dev("DataUpload", "Preparing webhook payload", {
        narrationStyle,
        narrationGenre,
        petType: pet.type,
      })

      const webhookPayload = {
        video_url: videoUrl,
        pet_id: pet.id,
        user_id: user.id,
        pet_name: pet.name,
        pet_type: pet.type,
        pet_breed: pet.breed,
        pet_gender: pet.gender,
        pet_age: pet.pet_age,
        personality_energy: pet.personality_energy,
        personality_sociability: pet.personality_sociability,
        personality_confidence: pet.personality_confidence,
        personality_obedience: pet.personality_obedience,
        personality_play_style: pet.personality_play_style,
        personality_curiosity: pet.personality_curiosity,
        personality_territorial: pet.personality_territorial,
        video_metadata: {
          filename: selectedFile.name,
          filesize: selectedFile.size,
          filetype: selectedFile.type,
          upload_date: new Date().toISOString(),
          supabase_bucket: "pet-videos",
          supabase_storage_url: videoUrl,
        },
        email: user.email,
        processing_id: uuidv4(),
        analysis_type: "journal",
        timestamp: new Date().toISOString(),
        entry_date: new Date().toISOString().split("T")[0],
        direct_storage: true,
        narration_style: narrationStyle,
        narration_genre: narrationGenre,
        caption_style: "standard",
        content: "",
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }

      const webhookUrl = "/api/video/upload"

      clientLogger.info("DataUpload", "Sending webhook to authenticated endpoint")
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include session cookies
        body: JSON.stringify(webhookPayload),
      })

      if (!response.ok) {
        const error = await response.text()
        clientLogger.error("DataUpload", "Webhook failed", { status: response.status })
        throw Object.assign(new Error(`Start failed (${response.status}): ${error.slice(0, 300)}`), {
          statusCode: response.status,
        })
      }

      setUploadProgress(100)
      setCurrentStep("completed")

      clientLogger.success("DataUpload", "Video upload and processing initiated successfully")

      // Since credit deduction happens async via webhook, we calculate: if they have 2 now, they'll have 1 after
      if (balanceCheck.balance === 1 || balanceCheck.balance === 2) {
        const left = balanceCheck.balance - 1
        toast({
          title: left === 0 ? "That was your last tale" : "1 tale left",
          description:
            left === 0
              ? "Pick a plan to keep creating Pet Tales."
              : "You have 1 tale left after this one. Pick a plan to keep creating.",
          action: (
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">See plans</Link>
            </Button>
          ),
          duration: 8000,
        })
      }

      setIsUploading(false)
      setShowSuccessScreen(true)

      // toast({
      //   title: "Video uploaded! 🎉",
      //   description: "Your pet's tale is being created. Check back in a few minutes to see the result!",
      // })
      // router.push("/dashboard/reels")
      // router.refresh()
    } catch (error) {
      clientLogger.error("DataUpload", "Upload failed", error)
      const friendly = friendlyUploadError(error)
      toast({ title: friendly.title, description: friendly.tip, variant: "destructive", duration: 10000 })
      reportUploadFailure({
        stage: failedStage === "uploading_video" ? "upload" : "start",
        reason: friendly.reason,
        message: error instanceof Error ? error.message : String(error),
        file: selectedFile,
        info: clipInfo,
      })
    } finally {
      setIsUploading(false)
      setCurrentStep("idle")
    }
  }

  const handleRecordClick = () => {
    clientLogger.info("DataUpload", "Camera recording initiated")
    if (recordInputRef.current) {
      recordInputRef.current.click()
    }
  }

  const handleUploadClick = () => {
    clientLogger.info("DataUpload", "File upload mode activated")
    if (uploadInputRef.current) {
      uploadInputRef.current.click()
    }
  }

  const handleRetake = () => {
    setSelectedFile(null)
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
      setVideoPreviewUrl(null)
    }
    setMode("select")
    clientLogger.info("DataUpload", "Video retake initiated")
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case "preparing":
        return "Preparing upload..."
      case "checking_credits":
        return "Checking your tales..."
      case "checking_rate_limit": // Added rate limit step description
        return "Checking upload limits..."
      case "authenticating":
        return "Authenticating..."
      case "uploading_video":
        return `Uploading video: ${Math.round(uploadProgress)}%`
      case "processing":
        return "Starting AI processing..."
      case "completed":
        return "Upload completed!"
      default:
        return "Processing..."
    }
  }

  const selectedVoicePersonality = availableVoices.find((voice) => voice.value === narrationStyle)

  // Upload overlay
  if (isUploading) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
          <h3 className="text-xl font-semibold text-center">Creating Your Pet Tale</h3>
          <Progress value={uploadProgress} className="h-3" />
          <div className="flex items-center justify-center text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">{getStepDescription()}</span>
          </div>
          <p className="text-xs text-center text-gray-500">
            This may take a few moments. Please don't close this page.
          </p>
        </div>
      </div>
    )
  }

  if (showSuccessScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-teal-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              {/* Animated Success Icon */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full animate-pulse opacity-20" />
                <div className="absolute inset-2 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-10 w-10 text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">Upload Complete! 🎉</h2>

              {/* Pet info snippet */}
              {selectedPet && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Avatar className="h-8 w-8 border-2 border-teal-200">
                    <AvatarImage src={selectedPet.image_url || ""} alt={selectedPet.name} />
                    <AvatarFallback className="bg-teal-100 text-teal-700 text-sm">
                      {getPetEmoji(selectedPet.type)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Creating {selectedPet.name}'s tale...
                  </span>
                </div>
              )}

              {/* Main message */}
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Your pet's tale is now being created. This typically takes{" "}
                <span className="font-semibold text-teal-600 dark:text-teal-400">3-5 minutes</span> as our AI works its
                magic.
              </p>

              {/* What's happening section */}
              <div className="bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-900/30 dark:to-blue-900/30 rounded-xl p-4 mb-6">
                <p className="text-xs font-medium text-teal-800 dark:text-teal-300 uppercase tracking-wide mb-3">
                  What's happening now
                </p>
                <div className="space-y-2 text-sm text-left">
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs">🎬</span>
                    </div>
                    <span>Analyzing your video</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs">✍️</span>
                    </div>
                    <span>Writing a personalized story</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs">🎙️</span>
                    </div>
                    <span>Generating AI voiceover</span>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => {
                  router.push("/dashboard/reels")
                  router.refresh()
                }}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white shadow-lg shadow-teal-500/25 transition-all duration-200"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                View My Tales
              </Button>

              {/* Footer note */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Your tale will appear on the Tales page once ready
              </p>
            </CardContent>
          </Card>

          {/* Decorative elements for mobile delight */}
          <div className="hidden sm:block absolute top-10 left-10 text-4xl opacity-20 animate-bounce">🐾</div>
          <div className="hidden sm:block absolute bottom-10 right-10 text-4xl opacity-20 animate-bounce delay-150">
            ✨
          </div>
        </div>
      </div>
    )
  }

  const hiddenInputs = (
    <>
      <input
        ref={recordInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelection(file)
          e.target.value = ""
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelection(file)
          e.target.value = ""
        }}
      />
    </>
  )

  const selectedGenre = NARRATION_GENRES.find((g) => g.value === narrationGenre)

  // Step 2: video picked. Everything else has a default, so one tap on "Create Tale" works.
  // Layout for a first-time user on a phone: a small clip card (not a screen-filling black box),
  // three numbered picks that are already set, and the Create button always in reach at the bottom.
  if (mode === "preview" && selectedFile && videoPreviewUrl) {
    const starName = isAddingPet ? quickPet.name.trim() : selectedPet?.name
    const needsName = isAddingPet && !quickPet.name.trim()
    const clipLength = formatClipLength(clipSeconds)
    return (
      <div className="mx-auto max-w-md space-y-6 pb-36 md:pb-0">
        {hiddenInputs}
        <OutOfCreditsModal
          isOpen={showOutOfCreditsModal}
          onClose={() => setShowOutOfCreditsModal(false)}
          balance={creditBalance || 0}
          pack={pack}
        />

        {/* Clip card */}
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setShowClipPlayer(true)}
            aria-label="Play your clip"
            className="relative h-28 w-[63px] shrink-0 overflow-hidden rounded-xl bg-gray-900"
          >
            {/* #t=0.1 makes iOS draw the first frame instead of a black box */}
            <video
              src={`${videoPreviewUrl}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
              onLoadedMetadata={(e) => setClipSeconds(e.currentTarget.duration)}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow">
                <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
              </span>
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-teal-700">
              <Check className="h-4 w-4" strokeWidth={3} /> Clip ready{clipLength ? ` · ${clipLength}` : ""}
            </p>
            <p className="mt-0.5 text-lg font-semibold leading-snug text-gray-900 dark:text-white">
              Now make it {starName ? `${starName}'s` : "your pet's"} tale
            </p>
            <button type="button" onClick={handleRetake} className="mt-1 text-sm font-medium text-gray-500 underline-offset-2 hover:underline">
              Use a different clip
            </button>
          </div>
        </div>

        <p className="-mt-2 text-center text-sm text-gray-500">
          We picked a vibe and voice for you. Change anything, or just tap <span className="font-semibold text-gray-700">Create Tale</span>.
        </p>

        {/* 1. Star */}
        <section className="space-y-3">
          <StepHeading n={1} title="Who's the star?" />
          {isAddingPet ? (
            <div className="rounded-2xl border-2 border-teal-200 bg-white p-4 dark:border-teal-800 dark:bg-gray-900">
              <PetBasicsFields compact values={quickPet} onChange={setQuickPet} />
              {pets.length > 0 && (
                <Button
                  variant="link"
                  className="mt-1 px-0 text-teal-700"
                  onClick={() => {
                    setIsAddingPet(false)
                    setPetId(pets[0].id)
                  }}
                >
                  Choose an existing pet instead
                </Button>
              )}
            </div>
          ) : (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {pets.map((pet) => {
                const active = petId === pet.id
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setPetId(pet.id)}
                    aria-pressed={active}
                    className={`flex h-12 shrink-0 items-center gap-2 rounded-full border-2 pl-1.5 pr-4 transition-colors ${
                      active
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={pet.image_url || ""} alt={pet.name} />
                      <AvatarFallback className="bg-teal-100 text-sm text-teal-700">{getPetEmoji(pet.type)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{pet.name}</span>
                    {active && <Check className="h-4 w-4 text-teal-600" strokeWidth={3} />}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsAddingPet(true)}
                className="flex h-12 shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-gray-300 px-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300"
              >
                <Plus className="h-4 w-4" /> New pet
              </button>
            </div>
          )}
        </section>

        {/* 2. Vibe */}
        <section className="space-y-3">
          <StepHeading n={2} title="Pick a vibe" hint="the story's mood" />
          <div className="grid grid-cols-2 gap-2">
            {NARRATION_GENRES.map((genre) => {
              const active = narrationGenre === genre.value
              return (
                <button
                  key={genre.value}
                  type="button"
                  onClick={() => setNarrationGenre(genre.value)}
                  aria-pressed={active}
                  className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? "border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-100"
                      : "border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  <span className="text-lg">{genre.emoji}</span>
                  <span>{genre.label}</span>
                </button>
              )
            })}
          </div>
          {selectedGenre && <p className="text-sm text-gray-500">{selectedGenre.emoji} {selectedGenre.description}</p>}
        </section>

        {/* 3. Voice */}
        <section className="space-y-3">
          <StepHeading n={3} title="Pick a voice" hint="who tells it" />
          <VoicePicker voices={availableVoices} selectedVoice={narrationStyle} onSelectVoice={setNarrationStyle} />
        </section>

        {isOutOfCredits && <OutOfCreditsBanner balance={creditBalance || 0} pack={pack} />}

        {/* Create bar: pinned to the bottom on phones (the bottom nav is hidden on this page, see
            isPrivateTaleViewer in bottom-nav.tsx), inline on larger screens */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto max-w-md">
            <Button
              onClick={handleVideoUpload}
              className="h-14 w-full rounded-xl bg-teal-600 text-lg font-semibold shadow-lg shadow-teal-600/20 hover:bg-teal-700"
              disabled={isOutOfCredits || isCheckingCredits || needsName}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {needsName ? "Add your pet's name above" : "Create Tale"}
            </Button>
            <p className="mt-1.5 truncate text-center text-xs text-gray-500">
              {[starName, selectedGenre?.label, selectedVoicePersonality?.label].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {/* Full-screen clip player (above the bottom nav, which sits at z-[9999]) */}
        {showClipPlayer && (
          <div
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/90 px-4 pb-4 pt-[calc(4rem+env(safe-area-inset-top))]"
            onClick={() => setShowClipPlayer(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Your clip"
          >
            <video
              src={videoPreviewUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[80dvh] w-full max-w-sm rounded-xl bg-black"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setShowClipPlayer(false)}
              aria-label="Close"
              className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // Step 1: just get a video. No forms in the way.
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
          {pets.length === 0 ? "Let's make your first tale" : "What's your pet up to?"}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pick a clip of your pet. We'll write the story and add a voice and captions.
        </p>
      </div>
      {hiddenInputs}
      <OutOfCreditsModal
        isOpen={showOutOfCreditsModal}
        onClose={() => setShowOutOfCreditsModal(false)}
        balance={creditBalance || 0}
        pack={pack}
      />

      {isOutOfCredits && (
        <OutOfCreditsBanner balance={creditBalance || 0} pack={pack} />
      )}

      <button
        type="button"
        onClick={handleUploadClick}
        disabled={isOutOfCredits || isCheckingCredits}
        className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/60 dark:bg-teal-900/20 py-12 px-6 text-center transition-colors hover:bg-teal-50 disabled:opacity-50"
      >
        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-600 text-white shadow-lg">
          <Upload className="h-7 w-7" />
        </span>
        <span className="text-xl font-semibold text-gray-900 dark:text-white">Choose a pet video</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">From your camera roll · under 75MB</span>
      </button>

      <Button
        onClick={handleRecordClick}
        variant="outline"
        className="w-full h-14 text-base border-2 border-teal-200 text-teal-700 bg-transparent dark:border-teal-800 dark:text-teal-400"
        disabled={isOutOfCredits || isCheckingCredits}
      >
        <Camera className="mr-2 h-5 w-5" />
        Record one now
      </Button>

      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
        <li>✨ Best results: 10 to 60 seconds with your pet doing something</li>
        <li>🎙️ Next you pick a mood and a voice (or keep ours), then tap Create</li>
        {creditBalance !== null && <li>🎟️ You have {creditBalance} tale{creditBalance === 1 ? "" : "s"}</li>}
      </ul>
    </div>
  )
}

// API call functions to replace server action calls
async function preflightBalanceCheck() {
  const res = await fetch("/api/credits/preflight", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  if (!res.ok) return { ok: false, balance: 0, code: "SERVER_ERROR", message: "Unable to check credits" }
  return res.json()
}

async function checkUploadRateLimit() {
  const res = await fetch("/api/rate-limit/upload", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  if (!res.ok) return { success: false, message: "Unable to check rate limit" }
  return res.json()
}
