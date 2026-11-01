"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { useSupabase } from "@/lib/supabase/provider"
import { useDirectUpload } from "@/lib/supabase/client-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Camera, Upload, Loader2, RotateCcw, Check, ArrowLeft, Sparkles } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { clientLogger } from "@/lib/client-logger"
import { CREDIT_MESSAGES } from "@/lib/types/credit-types"
import { OutOfCreditsBanner } from "@/components/ui/out-of-credits-banner"
import { OutOfCreditsModal } from "@/components/modals/out-of-credits-modal"
import Link from "next/link"
import { getVoicesByPetType } from "@/lib/voice-personalities"
import { NARRATION_GENRES } from "@/lib/narration-genres"
import { useToast } from "@/components/ui/use-toast" // Import useToast
import { VoiceSelector } from "./voice-selector" // Import VoiceSelector

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

export function VideoUploadInterface({ pets, selectedPetId }: VideoUploadInterfaceProps) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { uploadPetVideo } = useDirectUpload()
  const { toast } = useToast() // Declare useToast

  // Refs for file inputs
  const recordInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [petId, setPetId] = useState(selectedPetId)
  const [narrationStyle, setNarrationStyle] = useState("")
  const [narrationGenre, setNarrationGenre] = useState("heartfelt")
  const [mode, setMode] = useState<"select" | "upload" | "camera" | "preview">("select")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string>("idle")
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isOutOfCredits, setIsOutOfCredits] = useState(false)
  const [isCheckingCredits, setIsCheckingCredits] = useState(false)
  const [showOutOfCreditsModal, setShowOutOfCreditsModal] = useState(false)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)

  const selectedPet = pets.find((pet) => pet.id === petId)

  const availableVoices = selectedPet ? getVoicesByPetType(selectedPet.type) : []

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

  const handleRefreshCredits = async () => {
    const result = await checkCreditBalance()
    if (result.ok) {
      setIsOutOfCredits(false)
      router.refresh()
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

  const handleFileSelection = (file: File) => {
    if (!file) return

    // Validate file size (75MB limit)
    const MAX_SIZE = 75 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: "Please select a video smaller than 75MB.",
        variant: "destructive",
      })
      return
    }

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file.",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)

    // Create preview URL
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(previewUrl)
    setMode("preview")

    clientLogger.info("DataUpload", "Video file selected for preview")
    clientLogger.dev("DataUpload", "File details", {
      name: file.name,
      size: file.size,
      type: file.type,
    })
  }

  const handleVideoUpload = async () => {
    if (!selectedFile || !selectedPet) {
      toast({
        title: "Error",
        description: "Please select a pet and video file",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setCurrentStep("preparing")

      clientLogger.info("DataUpload", "Starting video upload process")
      clientLogger.dev("DataUpload", "Upload details", {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        petName: selectedPet.name,
        narrationStyle,
        narrationGenre,
      })

      setCurrentStep("checking_credits")
      const balanceCheck = await preflightBalanceCheck()

      if (!balanceCheck.ok) {
        if (balanceCheck.code === "OUT_OF_CREDITS") {
          setShowOutOfCreditsModal(true)
          toast({
            title: "You're out of credits.",
            description: CREDIT_MESSAGES.OUT_OF_CREDITS,
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
            description: balanceCheck.message || "Unable to verify credits",
            variant: "destructive",
          })
          return
        }
      }

      // Update credit balance state
      setCreditBalance(balanceCheck.balance)
      setIsOutOfCredits(false)

      setCurrentStep("checking_rate_limit")
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
      setCurrentStep("authenticating")
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        clientLogger.error("DataUpload", "User not authenticated")
        throw new Error("User not authenticated")
      }

      // Upload video to Supabase storage
      setCurrentStep("uploading_video")
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
      setCurrentStep("processing")
      clientLogger.dev("DataUpload", "Preparing webhook payload", {
        narrationStyle,
        narrationGenre,
        petType: selectedPet.type,
      })

      const webhookPayload = {
        video_url: videoUrl,
        pet_id: petId,
        user_id: user.id,
        pet_name: selectedPet.name,
        pet_type: selectedPet.type,
        pet_breed: selectedPet.breed,
        pet_gender: selectedPet.gender,
        pet_age: selectedPet.pet_age,
        personality_energy: selectedPet.personality_energy,
        personality_sociability: selectedPet.personality_sociability,
        personality_confidence: selectedPet.personality_confidence,
        personality_obedience: selectedPet.personality_obedience,
        personality_play_style: selectedPet.personality_play_style,
        personality_curiosity: selectedPet.personality_curiosity,
        personality_territorial: selectedPet.personality_territorial,
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
        throw new Error("Processing failed - please try again")
      }

      setUploadProgress(100)
      setCurrentStep("completed")

      clientLogger.success("DataUpload", "Video upload and processing initiated successfully")

      // Since credit deduction happens async via webhook, we calculate: if they have 2 now, they'll have 1 after
      if (balanceCheck.balance === 2) {
        toast({
          title: "⚠️ Last credit after this!",
          description: "You'll have 1 credit left. Upgrade to keep creating amazing Pet Tales.",
          action: (
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">Upgrade</Link>
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
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload video",
        variant: "destructive",
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
        return "Checking credit balance..."
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

  // Video preview mode
  if (mode === "preview" && selectedFile && videoPreviewUrl) {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <Button variant="outline" onClick={handleRetake} className="mb-4 bg-transparent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h2 className="text-2xl font-bold mb-2">Review & Create</h2>
          <p className="text-muted-foreground">Preview your video and create your tale</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* LEFT COLUMN: Settings (Sticky on desktop) */}
          <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <div className="hidden lg:block">
              <Button variant="outline" onClick={handleRetake} className="mb-4 bg-transparent">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Upload
              </Button>
              <h2 className="text-2xl font-bold mb-2">Review & Create</h2>
              <p className="text-muted-foreground">Preview your video and create your tale</p>
            </div>

            {/* Pet Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pet Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedPet?.image_url || ""} alt={selectedPet?.name} />
                    <AvatarFallback className="bg-teal-100 text-teal-700 text-xl">
                      {getPetEmoji(selectedPet?.type || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedPet?.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedPet?.breed || selectedPet?.type}
                    </p>
                    <p className="text-sm text-teal-600 font-medium">
                      {selectedPet ? getTopPersonalityTraits(selectedPet) : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Voice Personality Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pet's Voice</CardTitle>
              </CardHeader>
              <CardContent>
                {availableVoices
                  .filter((v) => v.value === narrationStyle)
                  .map((voice) => (
                    <div key={voice.value} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/30 text-2xl">
                        {voice.emoji}
                      </div>
                      <div>
                        <h3 className="font-semibold">{voice.label}</h3>
                        <p className="text-sm text-muted-foreground">{voice.description}</p>
                      </div>
                    </div>
                  ))}
                <Button variant="outline" onClick={() => setMode("select")} className="w-full mt-4 bg-transparent">
                  Change Voice
                </Button>
              </CardContent>
            </Card>

            {/* Narration Genre Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Narration Vibe</CardTitle>
              </CardHeader>
              <CardContent>
                {NARRATION_GENRES.filter((g) => g.value === narrationGenre).map((genre) => (
                  <div key={genre.value} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/30 text-2xl">
                      {genre.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold">{genre.label}</h3>
                      <p className="text-sm text-muted-foreground">{genre.description}</p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setMode("select")} className="w-full mt-4 bg-transparent">
                  Update the Vibe
                </Button>
              </CardContent>
            </Card>

            {/* File Information */}
            <Card className="hidden lg:block">
              <CardHeader>
                <CardTitle className="text-lg">Video Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File name:</span>
                  <span className="font-medium truncate ml-2">{selectedFile?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-medium">
                    {selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : 0} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{selectedFile?.type || "video/*"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Video Preview */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="relative aspect-[9/16] max-w-md mx-auto lg:max-w-full rounded-lg overflow-hidden bg-black">
                  <video
                    ref={videoPreviewRef}
                    src={videoPreviewUrl || ""}
                    controls
                    className="w-full h-full object-contain"
                    playsInline
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Button variant="outline" onClick={handleRetake} className="h-12 bg-transparent">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retake
                  </Button>
                  <Button
                    onClick={handleVideoUpload}
                    className="h-12 bg-teal-600 hover:bg-teal-700"
                    disabled={isOutOfCredits || isCheckingCredits}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Create Tale
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Out of Credits Banner (if applicable) */}
            {isOutOfCredits && (
              <OutOfCreditsBanner
                balance={creditBalance || 0}
                onClaimDaily={undefined}
                isClaimingDaily={false}
                onRefreshCredits={handleRefreshCredits}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main selection interface
  return (
    <div className="space-y-6">
      <OutOfCreditsModal
        isOpen={showOutOfCreditsModal}
        onClose={() => setShowOutOfCreditsModal(false)}
        currentTier="free"
        resetDate={null}
        balance={creditBalance || 0}
      />

      {isOutOfCredits && (
        <OutOfCreditsBanner
          balance={creditBalance || 0}
          onClaimDaily={undefined}
          isClaimingDaily={false}
          onRefreshCredits={handleRefreshCredits}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={recordInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelection(file)
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
        }}
      />

      {/* Pet Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Choose your pet</Label>
        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className={`relative flex items-center p-3 rounded-lg cursor-pointer border-2 transition-colors ${
                petId === pet.id
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 dark:border-teal-400"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
              onClick={() => {
                setPetId(pet.id)
                clientLogger.dev("DataUpload", "Pet selected", { petId: pet.id, petName: pet.name })
              }}
            >
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage src={pet.image_url || ""} alt={pet.name} />
                <AvatarFallback className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {getPetEmoji(pet.type) || pet.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{pet.name}</span>

              {petId === pet.id && (
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
          ))}
        </div>
      </div>

      {/* Voice Personality Selection */}
      <div className="space-y-4">
        {availableVoices.length === 0 ? (
          <>
            <Label className="text-base font-medium">Pet's Voice</Label>
            <p className="text-sm text-muted-foreground">Please select a pet first</p>
          </>
        ) : (
          <VoiceSelector
            voices={availableVoices}
            selectedVoice={narrationStyle}
            onSelectVoice={(voiceValue) => {
              setNarrationStyle(voiceValue)
              clientLogger.dev("DataUpload", "Voice personality selected", { voice: voiceValue })
            }}
          />
        )}
      </div>

      {/* Narration Genre Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Narration Vibe</Label>
        <div className="grid grid-cols-1 gap-3">
          {NARRATION_GENRES.map((genre) => (
            <div
              key={genre.value}
              className={`flex items-center p-4 rounded-lg cursor-pointer border-2 transition-all duration-200 ${
                narrationGenre === genre.value
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30 dark:border-teal-400"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
              onClick={() => {
                setNarrationGenre(genre.value)
                clientLogger.dev("DataUpload", "Narration genre selected", { genre: genre.value })
              }}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 mr-4 text-xl">
                {genre.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-base text-foreground mb-1">{genre.label}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{genre.description}</p>
              </div>
              {narrationGenre === genre.value && (
                <div className="ml-3 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upload Actions */}
      <div className="grid grid-cols-2 gap-4 pt-4">
        <Button
          onClick={handleRecordClick}
          className="h-16 text-lg bg-teal-600 hover:bg-teal-700 text-white"
          disabled={!selectedPet || isOutOfCredits || isCheckingCredits || !narrationStyle || !narrationGenre}
        >
          <Camera className="mr-2 h-5 w-5" />
          Record Video
        </Button>
        <Button
          onClick={handleUploadClick}
          variant="outline"
          className="h-16 text-lg border-2 border-teal-200 text-teal-700 hover:bg-teal-50 bg-transparent dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-900/30"
          disabled={!selectedPet || isOutOfCredits || isCheckingCredits || !narrationStyle || !narrationGenre}
        >
          <Upload className="mr-2 h-5 w-5" />
          Upload Video
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <p>
          📱 <strong>Record:</strong> Use your camera to capture a moment
        </p>
        <p>
          📁 <strong>Upload:</strong> Choose an existing video from your device
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Videos should be under 75MB and show your pet in action for best results
        </p>
        {creditBalance !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Current credits: {creditBalance} • Each tale costs at least 1 credit
          </p>
        )}
      </div>
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
