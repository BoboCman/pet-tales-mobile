"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface QuickPetValues {
  name: string
  type: "dog" | "cat"
  gender: "male" | "female"
}

interface QuickPetFieldsProps {
  values: QuickPetValues
  onChange: (values: QuickPetValues) => void
}

// Sensible defaults so a brand-new user only has to type a name.
// Breed, age and personality can be filled in later from the pet's profile.
export function quickPetDefaults(values: QuickPetValues) {
  const isDog = values.type === "dog"
  return {
    name: values.name.trim(),
    type: values.type,
    gender: values.gender,
    breed: isDog ? "Mixed Breed (Mutt)" : "Domestic Mixed Breed",
    pet_age: isDog ? "Adult: 4–7 years" : "Adult: 4–8 years",
    image_url: null,
    personality_energy: 3,
    personality_sociability: 3,
    personality_confidence: 3,
    personality_obedience: isDog ? 3 : null,
    personality_play_style: isDog ? 3 : null,
    personality_curiosity: isDog ? null : 3,
    personality_territorial: isDog ? null : 3,
  }
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-11 rounded-lg border-2 text-base font-medium transition-colors",
            value === opt.value
              ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
              : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function QuickPetFields({ values, onChange }: QuickPetFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="quick-pet-name">Pet's name</Label>
        <Input
          id="quick-pet-name"
          placeholder="e.g. Biscuit"
          value={values.name}
          maxLength={40}
          autoComplete="off"
          className="h-11 text-base"
          onChange={(e) => onChange({ ...values, name: e.target.value })}
        />
      </div>
      <Toggle
        options={[
          { value: "dog", label: "🐶 Dog" },
          { value: "cat", label: "🐱 Cat" },
        ]}
        value={values.type}
        onChange={(type) => onChange({ ...values, type })}
      />
      <Toggle
        options={[
          { value: "male", label: "Boy" },
          { value: "female", label: "Girl" },
        ]}
        value={values.gender}
        onChange={(gender) => onChange({ ...values, gender })}
      />
      <p className="text-xs text-muted-foreground">
        That's all we need. You can add breed, age and personality later to make tales even more "them".
      </p>
    </div>
  )
}
