export interface VoicePersonality {
  value: string
  emoji: string
  label: string
  description: string
  elevenLabsVoiceId: string
}

export const UNIVERSAL_VOICES: VoicePersonality[] = [
  {
    value: "baby_innocent",
    emoji: "👶",
    label: "Baby Talk",
    description: "Adorable, innocent, sweet - perfect for puppies, kittens, or any cute moment",
    elevenLabsVoiceId: "mfxNBRqEk8EB9LJ8oQp5",
  },
  {
    value: "british_narrator",
    emoji: "🎩",
    label: "British Narrator",
    description: "Posh, sophisticated documentary style - makes any moment sound epic",
    elevenLabsVoiceId: "tstMFrPj38Ce5M7uZCgE",
  },
  {
    value: "sassy_adult",
    emoji: "😏",
    label: "Sassy & Sarcastic",
    description: "Quick-witted, eye-rolling energy - perfect for pets who know they're being ridiculous",
    elevenLabsVoiceId: "6HtZcen4RozXhQvuPS1d",
  },
  {
    value: "tough_guy",
    emoji: "🛡️",
    label: "Tough Guy",
    description: "Deep, gruff protector — quiet strength and fierce loyalty underneath",
    elevenLabsVoiceId: "JmqRjh4bc0GoMRk3fkHT",
  },
  {
    value: "southern_belle",
    emoji: "🎀",
    label: "Southern Belle",
    description: 'Sweet Southern charm with a sassy streak — "bless your heart" hospitality',
    elevenLabsVoiceId: "9QPzUjm1evjwY2ENQBKU",
  },
  {
    value: "gentle_giant",
    emoji: "🐻",
    label: "Gentle Giant",
    description: "Big, slow, and sweet — lovably dopey with a heart of gold",
    elevenLabsVoiceId: "qDASVd4t1usqpm8xctyc",
  },
  {
    value: "irish_lass",
    emoji: "🍀",
    label: "Irish Lass",
    description: "Warm Irish charm with a lilting lilt — cozy, grounded, storyteller vibes",
    elevenLabsVoiceId: "sgk995upfe3tYLvoGcBN",
  },
  {
    value: "chill_swag",
    emoji: "🏝️",
    label: "Island Storyteller",
    description: "Authentic Caribbean warmth with raspy swagger — reggae soul, island vibes",
    elevenLabsVoiceId: "dhwafD61uVd8h85wAZSE",
  },
  {
    value: "sweet_pea",
    emoji: "🌸",
    label: "Sweet Pea",
    description: "Soft, giggly wonder — wide-eyed curiosity discovering the world",
    elevenLabsVoiceId: "kVgT9dFIApm2BsXXgyjh",
  },
  {
    value: "grandpa_storyteller",
    emoji: "👴",
    label: "Grandpa Storyteller",
    description: 'Warm, wise grandpa energy — "back in my day" tales told with love',
    elevenLabsVoiceId: "NOpBlnGInO9m6vDvFkFC",
  },
  {
    value: "hyper_enthusiast",
    emoji: "⚡",
    label: "Super Excited",
    description: "Boundless energy, golden retriever vibes - EVERYTHING IS AMAZING!",
    elevenLabsVoiceId: "DSxFj2OW4dg4nbM8x3ve",
  },
  {
    value: "grandma_storyteller",
    emoji: "👵",
    label: "Grandma Storyteller",
    description: "Warm, nurturing grandma energy — cozy tales and gentle wisdom",
    elevenLabsVoiceId: "0rEo3eAjssGDUCXHYENf",
  },
]

export const ALL_VOICES: VoicePersonality[] = UNIVERSAL_VOICES

export function getVoicesByPetType(petType: string): VoicePersonality[] {
  // Return universal voices regardless of pet type
  return UNIVERSAL_VOICES
}

// Helper function to get voice by value
export function getVoiceByValue(value: string): VoicePersonality | undefined {
  return ALL_VOICES.find((voice) => voice.value === value)
}

// Helper function to get ElevenLabs voice ID
export function getElevenLabsVoiceId(value: string): string {
  const voice = getVoiceByValue(value)
  return voice?.elevenLabsVoiceId || UNIVERSAL_VOICES[0].elevenLabsVoiceId // Default to first universal voice
}
