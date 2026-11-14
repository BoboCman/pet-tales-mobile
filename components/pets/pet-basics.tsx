"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, PawPrint } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DEFAULT_AGE, DEFAULT_BREED, type PetKind } from "@/lib/pets/options"

/**
 * The one "Meet your pet" block: photo, name, dog/cat, boy/girl. Used on the Create screen,
 * Add pet and Edit pet, so a pet is described the same way everywhere.
 */
export interface PetBasicsValues {
  name: string
  type: PetKind
  gender: "male" | "female"
  /** A newly picked photo (already shrunk); null keeps the current one */
  photo?: File | null
}

/** Everything a brand-new pet needs. Breed, age and personality start neutral and can be set later. */
export function newPetDefaults(values: PetBasicsValues) {
  const isDog = values.type === "dog"
  return {
    name: values.name.trim(),
    type: values.type,
    gender: values.gender,
    breed: DEFAULT_BREED[values.type],
    pet_age: DEFAULT_AGE[values.type],
    image_url: null as string | null,
    personality_energy: 3,
    personality_sociability: 3,
    personality_confidence: 3,
    personality_obedience: isDog ? 3 : null,
    personality_play_style: isDog ? 3 : null,
    personality_curiosity: isDog ? null : 3,
    personality_territorial: isDog ? null : 3,
  }
}

/** Phone photos are 3-12 MB; a 900px JPEG looks the same in a profile circle. Falls back to the original. */
export async function shrinkPhoto(file: File, max = 900): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85))
    if (!blob) return file
    return new File([blob], "pet-photo.jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
  big,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  big?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-xl border-2 font-medium transition-colors",
            big ? "h-14 text-lg" : "h-11 text-base",
            value === opt.value
              ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
              : "border-gray-200 text-gray-700 active:border-gray-300 dark:border-gray-700 dark:text-gray-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function PetPhotoPicker({
  image,
  onPick,
  size = "lg",
  name,
}: {
  image: string | null
  onPick: (file: File) => void
  size?: "sm" | "lg"
  name?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      aria-label={image ? "Change photo" : "Add a photo"}
      className={cn(
        "relative shrink-0 rounded-full",
        size === "lg" ? "h-28 w-28" : "h-14 w-14",
      )}
    >
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/30">
        {image ? (
          <img src={image} alt={name ? `${name}'s photo` : ""} className="h-full w-full object-cover" />
        ) : (
          <PawPrint className={cn("text-teal-400", size === "lg" ? "h-10 w-10" : "h-6 w-6")} />
        )}
      </span>
      <span
        className={cn(
          "absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-teal-600 text-white shadow ring-2 ring-white dark:ring-gray-950",
          size === "lg" ? "h-9 w-9" : "h-6 w-6",
        )}
      >
        <Camera className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ""
        }}
      />
    </button>
  )
}

export function PetBasicsFields({
  values,
  onChange,
  currentImage = null,
  compact = false,
  autoFocus = false,
}: {
  values: PetBasicsValues
  onChange: (values: PetBasicsValues) => void
  /** The pet's saved photo, shown until a new one is picked */
  currentImage?: string | null
  /** Create screen: small photo beside the name instead of a big centered circle */
  compact?: boolean
  autoFocus?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!values.photo) return setPreview(null)
    const url = URL.createObjectURL(values.photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [values.photo])

  const pick = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) return
    onChange({ ...values, photo: await shrinkPhoto(file) })
  }
  const image = preview ?? currentImage

  const nameInput = (
    <Input
      id="pet-name"
      placeholder="e.g. Biscuit"
      value={values.name}
      maxLength={40}
      autoComplete="off"
      autoFocus={autoFocus}
      className={compact ? "h-11 text-base" : "h-12 text-lg"}
      onChange={(e) => onChange({ ...values, name: e.target.value })}
    />
  )

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {compact ? (
        <div className="space-y-1.5">
          <Label htmlFor="pet-name">Pet&apos;s name</Label>
          <div className="flex items-center gap-3">
            <PetPhotoPicker image={image} onPick={pick} size="sm" name={values.name} />
            <div className="flex-1">{nameInput}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <PetPhotoPicker image={image} onPick={pick} name={values.name} />
            <span className="text-sm text-gray-500">{image ? "Tap to change photo" : "Add a photo (optional)"}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pet-name" className="text-base">
              Name
            </Label>
            {nameInput}
          </div>
        </>
      )}
      <Toggle
        big={!compact}
        options={[
          { value: "dog", label: "🐶 Dog" },
          { value: "cat", label: "🐱 Cat" },
        ]}
        value={values.type}
        onChange={(type) => onChange({ ...values, type })}
      />
      <Toggle
        big={!compact}
        options={[
          { value: "male", label: "Boy" },
          { value: "female", label: "Girl" },
        ]}
        value={values.gender}
        onChange={(gender) => onChange({ ...values, gender })}
      />
      {compact && (
        <p className="text-xs text-muted-foreground">
          That&apos;s all we need. You can add breed, age and personality later to make tales even more &quot;them&quot;.
        </p>
      )}
    </div>
  )
}
