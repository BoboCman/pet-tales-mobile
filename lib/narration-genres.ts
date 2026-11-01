export interface NarrationGenre {
  value: string
  emoji: string
  label: string
  description: string
}

export const NARRATION_GENRES: NarrationGenre[] = [
  {
    value: "heartfelt",
    emoji: "❤️",
    label: "Heartfelt",
    description: "Pure love and devotion to their human",
  },
  {
    value: "comedy",
    emoji: "😂",
    label: "Comedy",
    description: "Savage roasts and lovable complaints",
  },
  {
    value: "sports",
    emoji: "🎤",
    label: "Play-by-Play",
    description: "Mic'd up athlete hyping their own moves",
  },
  {
    value: "swag",
    emoji: "😤",
    label: "Complainer",
    description: "Dramatic critic, nothing is ever good enough",
  },
  {
    value: "documentary",
    emoji: "🧘",
    label: "Philosopher",
    description: "Accidentally stumbles into deep thoughts",
  },
  {
    value: "chaotic",
    emoji: "💭",
    label: "Chaotic",
    description: "Scattered brain, zero filter",
  },
]
