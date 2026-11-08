/**
 * Pet personality, as the narration pipeline uses it: five 1-5 traits (energy, sociability,
 * confidence, plus obedience/play style for dogs or curiosity/territorial for cats) turned into
 * a persona by n8n. Labels match components/pets/personality-traits.tsx and the n8n prompt.
 */

export type PersonalityPet = {
  type?: string | null
  personality_energy?: number | null
  personality_sociability?: number | null
  personality_confidence?: number | null
  personality_obedience?: number | null
  personality_play_style?: number | null
  personality_curiosity?: number | null
  personality_territorial?: number | null
}

export type TraitKey =
  | "personality_energy"
  | "personality_sociability"
  | "personality_confidence"
  | "personality_obedience"
  | "personality_play_style"
  | "personality_curiosity"
  | "personality_territorial"

export type TraitQuestion = {
  key: TraitKey
  /** {name} is replaced with the pet's name */
  question: string
  options: { label: string; emoji: string }[]
}

const COMMON: TraitQuestion[] = [
  {
    key: "personality_energy",
    question: "How does {name} spend a free afternoon?",
    options: [
      { emoji: "🧘", label: "Zen Master" },
      { emoji: "🛋️", label: "Couch Potato" },
      { emoji: "⚖️", label: "Balanced" },
      { emoji: "⚡", label: "Peppy" },
      { emoji: "🌪️", label: "Zoomies!" },
    ],
  },
  {
    key: "personality_sociability",
    question: "When guests come over, {name} is…",
    options: [
      { emoji: "🐺", label: "Lone Wolf" },
      { emoji: "🧐", label: "Selective Socializer" },
      { emoji: "🙂", label: "Friendly" },
      { emoji: "🎉", label: "Party Animal" },
      { emoji: "🧲", label: "Velcro Pet" },
    ],
  },
  {
    key: "personality_confidence",
    question: "Something new appears in the house. {name}…",
    options: [
      { emoji: "🫣", label: "Shy Bean" },
      { emoji: "🐾", label: "Cautious Paws" },
      { emoji: "😌", label: "Steady" },
      { emoji: "🦁", label: "Brave" },
      { emoji: "👑", label: "Fearless Leader" },
    ],
  },
]

const DOG: TraitQuestion[] = [
  {
    key: "personality_obedience",
    question: "You say “sit.” {name}…",
    options: [
      { emoji: "🦋", label: "Free Spirit" },
      { emoji: "🤝", label: "Negotiator" },
      { emoji: "🙏", label: "Tries Their Best" },
      { emoji: "📏", label: "Rule Follower" },
      { emoji: "🍎", label: "Teacher's Pet" },
    ],
  },
  {
    key: "personality_play_style",
    question: "Playtime with {name} looks like…",
    options: [
      { emoji: "♟️", label: "Chess Master" },
      { emoji: "🪶", label: "Gentle Player" },
      { emoji: "🎾", label: "Playful" },
      { emoji: "🦘", label: "Bouncy" },
      { emoji: "🤪", label: "Wild Child" },
    ],
  },
]

const CAT: TraitQuestion[] = [
  {
    key: "personality_curiosity",
    question: "A box arrives. {name}…",
    options: [
      { emoji: "😑", label: "Unbothered" },
      { emoji: "👀", label: "Occasionally Interested" },
      { emoji: "🤔", label: "Inquisitive" },
      { emoji: "🔍", label: "Inspector" },
      { emoji: "😼", label: "Trouble Finder" },
    ],
  },
  {
    key: "personality_territorial",
    question: "Someone sits in {name}'s spot…",
    options: [
      { emoji: "🤗", label: "Sharing is Caring" },
      { emoji: "😎", label: "Easy-Going" },
      { emoji: "🤨", label: "Mine Sometimes" },
      { emoji: "🛡️", label: "Protector" },
      { emoji: "🏰", label: "Guardian Supreme" },
    ],
  },
]

export function traitQuestions(petType: string | null | undefined): TraitQuestion[] {
  return [...COMMON, ...(petType === "cat" ? CAT : DOG)]
}

/**
 * Quick-added pets get every trait at 3 (the middle). A pet whose traits are all still 3 (or
 * empty) hasn't been described by its owner yet, so its tales use a generic "balanced" voice.
 */
export function isPersonalized(pet: PersonalityPet): boolean {
  const values = traitQuestions(pet.type).map((q) => pet[q.key])
  return values.some((v) => typeof v === "number" && v !== 3)
}
