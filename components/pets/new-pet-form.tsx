"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { PersonalityTraits } from "@/components/pets/personality-traits"
import { Loader2, X, Upload } from "lucide-react"
import { useDirectUpload } from "@/lib/supabase/client-storage"
import { clientLogger } from "@/lib/client-logger"
import { useSupabase } from "@/lib/supabase/provider"

const petSchema = z.object({
  name: z.string().min(1, "Pet name is required."),
  type: z.string().min(1, "Pet type is required."),
  pet_age: z.string().min(1, "Pet age is required."),
  breed: z.string().min(1, "Breed is required."),
  gender: z.enum(["male", "female"]),
  personality_energy: z.number().min(1).max(5).nullable().optional(),
  personality_sociability: z.number().min(1).max(5).nullable().optional(),
  personality_confidence: z.number().min(1).max(5).nullable().optional(),
  personality_obedience: z.number().min(1).max(5).nullable().optional(),
  personality_play_style: z.number().min(1).max(5).nullable().optional(),
  personality_curiosity: z.number().min(1).max(5).nullable().optional(),
  personality_territorial: z.number().min(1).max(5).nullable().optional(),
})

// Define breed options based on pet type
const breedOptions = {
  dog: [
    "Akita",
    "Alaskan Malamute",
    "American Bulldog",
    "American Pit Bull Terrier",
    "Anatolian Shepherd",
    "Australian Shepherd",
    "Beagle",
    "Bernedoodle",
    "Bernese Mountain Dog",
    "Bichon Frise",
    "Border Collie",
    "Boston Terrier",
    "Boxer",
    "Bulldog",
    "Cane Corso",
    "Cavalier King Charles Spaniel",
    "Chihuahua",
    "Cockapoo",
    "Cocker Spaniel",
    "Dachshund",
    "Doberman Pinscher",
    "English Springer Spaniel",
    "French Bulldog",
    "German Shepherd",
    "Goldendoodle",
    "Golden Retriever",
    "Great Dane",
    "Havanese",
    "Labradoodle",
    "Labrador Retriever",
    "Maltese",
    "Miniature Schnauzer",
    "Mixed Breed (Mutt)",
    "Newfoundland",
    "Pomapoo",
    "Pomeranian",
    "Poodle",
    "Rescue Dog (Breed Unknown)",
    "Rottweiler",
    "Sheepadoodle",
    "Shetland Sheepdog",
    "Shih Tzu",
    "Siberian Husky",
    "Staffordshire Bull Terrier",
    "Weimaraner",
    "West Highland White Terrier",
    "Whippet",
    "Yorkipoo",
    "Yorkshire Terrier",
  ],
  cat: [
    "American Curl",
    "American Shorthair",
    "Balinese",
    "Bengal",
    "Birman",
    "British Shorthair",
    "Burmese",
    "Chartreux",
    "Cornish Rex",
    "Devon Rex",
    "Domestic Longhair",
    "Domestic Mixed Breed",
    "Domestic Shorthair",
    "Egyptian Mau",
    "Exotic Shorthair",
    "Havana Brown",
    "Japanese Bobtail",
    "LaPerm",
    "Loving Mystery Mix",
    "Maine Coon",
    "Manx",
    "Norwegian Forest Cat",
    "Oriental Shorthair",
    "Persian",
    "Ragdoll",
    "Rescue Cat (Breed Unknown)",
    "Russian Blue",
    "Scottish Fold",
    "Selkirk Rex",
    "Shelter Treasure",
    "Siamese",
    "Snowshoe",
    "Somali",
    "Sphynx",
    "Tonkinese",
    "Turkish Angora",
  ],
}

// Define age options based on pet type
const ageOptions = {
  dog: [
    "Puppy: 0–1 year",
    "Young Adult: 1–3 years",
    "Adult: 4–7 years",
    "Mature Adult: 8–10 years",
    "Senior: 11–14 years",
    "Geriatric: 15+ years",
  ],
  cat: [
    "Kitten: 0–1 year",
    "Young Adult: 1–3 years",
    "Adult: 4–8 years",
    "Mature Adult: 9–12 years",
    "Senior: 13–17 years",
    "Geriatric: 18+ years",
  ],
}

interface NewPetFormProps {
  initialData?: any
  petId?: string
}

export function NewPetForm({ initialData, petId }: NewPetFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { supabase } = useSupabase()
  const { uploadPetPhoto } = useDirectUpload()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.image_url || null)
  const [selectedPetType, setSelectedPetType] = useState<"dog" | "cat" | "">(initialData?.type || "")
  const [uploadProgress, setUploadProgress] = useState(0)

  const form = useForm<z.infer<typeof petSchema>>({
    resolver: zodResolver(petSchema),
    defaultValues: {
      name: initialData?.name || "",
      type: initialData?.type || "",
      pet_age: initialData?.pet_age || "",
      breed: initialData?.breed || "",
      gender: initialData?.gender || "male",
      personality_energy: initialData?.personality_energy || 3,
      personality_sociability: initialData?.personality_sociability || 3,
      personality_confidence: initialData?.personality_confidence || 3,
      personality_obedience: initialData?.personality_obedience || null,
      personality_play_style: initialData?.personality_play_style || null,
      personality_curiosity: initialData?.personality_curiosity || null,
      personality_territorial: initialData?.personality_territorial || null,
    },
  })

  const handlePetTypeChange = (value: string) => {
    clientLogger.info("PetManagement", "Pet type selected", value)
    clientLogger.dev("PetManagement", "Pet type change", { newType: value })

    form.setValue("type", value)
    form.setValue("breed", "")
    form.setValue("pet_age", "")

    if (value === "dog") {
      setSelectedPetType("dog")
      form.setValue("personality_obedience", 3)
      form.setValue("personality_play_style", 3)
      form.setValue("personality_curiosity", null)
      form.setValue("personality_territorial", null)
    } else if (value === "cat") {
      setSelectedPetType("cat")
      form.setValue("personality_curiosity", 3)
      form.setValue("personality_territorial", 3)
      form.setValue("personality_obedience", null)
      form.setValue("personality_play_style", null)
    } else {
      setSelectedPetType("")
    }
  }

  const handlePersonalityChange = (trait: string, value: number) => {
    clientLogger.dev("PetManagement", "Personality trait updated", { trait, value })
    const fieldMapping: Record<string, keyof z.infer<typeof petSchema>> = {
      energy: "personality_energy",
      sociability: "personality_sociability",
      confidence: "personality_confidence",
      obedience: "personality_obedience",
      playStyle: "personality_play_style",
      curiosity: "personality_curiosity",
      territorial: "personality_territorial",
    }
    const fieldName = fieldMapping[trait]
    if (fieldName) {
      form.setValue(fieldName, value)
    }
  }

  async function onSubmit(values: z.infer<typeof petSchema>) {
    setIsSubmitting(true)
    clientLogger.info("PetManagement", petId ? "Starting pet update process" : "Starting new pet creation process")
    clientLogger.dev("PetManagement", "Form values", {
      name: values.name,
      type: values.type,
      breed: values.breed,
      hasPhoto: !!photoFile,
    })

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        clientLogger.error("PetManagement", "User not authenticated")
        throw new Error("User not authenticated")
      }

      let photoUrl = initialData?.image_url || null

      // Upload photo if selected
      if (photoFile) {
        clientLogger.info("PetManagement", "Starting photo upload")
        clientLogger.dev("PetManagement", "Photo upload details", {
          fileSize: photoFile.size,
          fileType: photoFile.type,
        })

        try {
          photoUrl = await uploadPetPhoto(photoFile, (progress) => {
            setUploadProgress(progress)
            clientLogger.progress("PetManagement", "Photo upload progress", progress)
          })
          clientLogger.success("PetManagement", "Photo uploaded successfully")
        } catch (uploadError) {
          clientLogger.error("PetManagement", "Photo upload failed", uploadError)
          throw new Error("Failed to upload photo. Please try again.")
        }
      }

      clientLogger.info("PetManagement", "Creating/updating pet record in database")

      const petData = {
        name: values.name,
        type: values.type,
        pet_age: values.pet_age,
        breed: values.breed,
        gender: values.gender,
        image_url: photoUrl,
        personality_energy: values.personality_energy,
        personality_sociability: values.personality_sociability,
        personality_confidence: values.personality_confidence,
        personality_obedience: values.personality_obedience,
        personality_play_style: values.personality_play_style,
        personality_curiosity: values.personality_curiosity,
        personality_territorial: values.personality_territorial,
      }

      if (petId) {
        // Update existing pet
        const { error } = await supabase
          .from("pets")
          .update({
            ...petData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", petId)
          .eq("user_id", user.id)

        if (error) {
          clientLogger.error("PetManagement", "Failed to update pet record", error)
          throw error
        }
        clientLogger.success("PetManagement", "Pet updated successfully")
        toast({ title: "Pet updated successfully!" })
      } else {
        // Create new pet
        const { error } = await supabase.from("pets").insert({
          ...petData,
          user_id: user.id,
        })

        if (error) {
          clientLogger.error("PetManagement", "Failed to create pet record", error)
          throw error
        }
        clientLogger.success("PetManagement", "Pet created successfully")
        toast({ title: "Pet created successfully!" })
      }

      clientLogger.dev("PetManagement", "Operation completed, navigating to pets dashboard")
      router.push("/dashboard/pets")
      router.refresh()
    } catch (error) {
      clientLogger.error("PetManagement", "Error saving pet", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save pet. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Validate file size (75MB limit)
      const MAX_SIZE = 75 * 1024 * 1024
      if (file.size > MAX_SIZE) {
        clientLogger.error("PetManagement", "File size exceeds limit", file.size / (1024 * 1024))
        toast({
          title: "File too large",
          description: "Please select a photo smaller than 75MB.",
          variant: "destructive",
        })
        return
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        clientLogger.error("PetManagement", "Invalid file type", file.type)
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        })
        return
      }

      setPhotoFile(file)
      clientLogger.info("PetManagement", "Photo file selected")
      clientLogger.dev("PetManagement", "Photo details", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
        clientLogger.dev("PetManagement", "Photo preview generated")
      }
      reader.readAsDataURL(file)
    }
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(initialData?.image_url || null)
    clientLogger.dev("PetManagement", "Photo cleared from form")
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{petId ? "Edit Pet" : "Add New Pet"}</CardTitle>
        <CardDescription>
          {petId
            ? "Update your pet's information and personality traits."
            : "Create a profile for your furry friend to start generating their tales!"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <FormLabel>Pet Photo</FormLabel>
              <div className="mt-2">
                {photoPreview ? (
                  <div className="relative h-48 w-full max-w-md mx-auto rounded-md overflow-hidden">
                    <img
                      src={photoPreview || "/placeholder.svg"}
                      alt="Photo preview"
                      className="h-full w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 rounded-full z-10"
                      onClick={clearPhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="photo-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 75MB</p>
                        </div>
                        <input
                          id="photo-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
                </div>
              )}
              <FormDescription className="text-center mt-2">
                Upload a photo of your pet. This will be used as their profile picture.
              </FormDescription>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pet Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Fluffy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pet Type</FormLabel>
                    <Select onValueChange={handlePetTypeChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pet type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dog">Dog</SelectItem>
                        <SelectItem value="cat">Cat</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pet_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pet Age</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedPetType}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedPetType ? "Select age" : "Select pet type first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedPetType &&
                          ageOptions[selectedPetType].map((age) => (
                            <SelectItem key={age} value={age}>
                              {age}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="breed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedPetType}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedPetType ? "Select breed" : "Select pet type first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {selectedPetType &&
                          breedOptions[selectedPetType].map((breed) => (
                            <SelectItem key={breed} value={breed}>
                              {breed}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Personality Traits Section */}
            <div className="border rounded-md p-3 sm:p-4 bg-gray-50 mt-6">
              <PersonalityTraits
                petType={form.watch("type")}
                values={{
                  energy: form.watch("personality_energy"),
                  sociability: form.watch("personality_sociability"),
                  confidence: form.watch("personality_confidence"),
                  obedience: form.watch("personality_obedience"),
                  playStyle: form.watch("personality_play_style"),
                  curiosity: form.watch("personality_curiosity"),
                  territorial: form.watch("personality_territorial"),
                }}
                onChange={handlePersonalityChange}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {petId ? "Updating Pet..." : "Creating Pet..."}
                  </>
                ) : petId ? (
                  "Update Pet"
                ) : (
                  "Create Pet"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
