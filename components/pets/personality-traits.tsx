"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { useState, useEffect } from "react"

interface PersonalityTraitsProps {
  petType: string
  values: {
    energy: number | null
    sociability: number | null
    confidence: number | null
    obedience: number | null
    playStyle: number | null
    curiosity: number | null
    territorial: number | null
  }
  onChange: (trait: string, value: number) => void
}

// Fun personality labels
const personalityLabels = {
  energy: ["Zen Master", "Couch Potato", "Balanced", "Peppy", "Zoomies!"],
  sociability: ["Lone Wolf", "Selective Socializer", "Friendly", "Party Animal", "Velcro Pet"],
  confidence: ["Shy Bean", "Cautious Paws", "Steady", "Brave", "Fearless Leader"],
  obedience: ["Free Spirit", "Negotiator", "Tries Their Best", "Rule Follower", "Teacher's Pet"],
  playStyle: ["Chess Master", "Gentle Player", "Playful", "Bouncy", "Wild Child"],
  curiosity: ["Unbothered", "Occasionally Interested", "Inquisitive", "Inspector", "Trouble Finder"],
  territorial: ["Sharing is Caring", "Easy-Going", "Mine Sometimes", "Protector", "Guardian Supreme"],
}

export function PersonalityTraits({ petType, values, onChange }: PersonalityTraitsProps) {
  const [activeTab, setActiveTab] = useState("common")
  const isDog = petType === "dog"
  const isCat = petType === "cat"

  // Set appropriate tab based on pet type
  useEffect(() => {
    if (isDog) {
      setActiveTab("common")
    } else if (isCat) {
      setActiveTab("common")
    }
  }, [petType, isDog, isCat])

  const handleSliderChange = (trait: string, value: number[]) => {
    onChange(trait, value[0])
  }

  // Helper to get the label for a trait based on its value
  const getTraitLabel = (trait: keyof typeof personalityLabels, value: number | null) => {
    if (!value || value < 1 || value > 5) return ""
    return personalityLabels[trait][value - 1]
  }

  const renderTraitSlider = (
    traitKey: keyof typeof values & keyof typeof personalityLabels,
    label: string,
    lowLabel: string,
    highLabel: string,
  ) => {
    const value = values[traitKey] || 3
    const traitLabel = getTraitLabel(traitKey, value)

    return (
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium">{label}</label>
          <span className="text-teal-600 font-bold text-sm">{traitLabel}</span>
        </div>
        <Slider
          defaultValue={[value]}
          value={[value]}
          min={1}
          max={5}
          step={1}
          onValueChange={(val) => handleSliderChange(traitKey, val)}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Personality Traits</h3>
      <p className="text-sm text-muted-foreground">
        Adjust these sliders to better describe your pet's personality. This helps us create more personalized content.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="common" className="text-xs sm:text-sm py-1 sm:py-2">
            <span className="hidden sm:inline">Common Traits</span>
            <span className="sm:hidden">Common</span>
          </TabsTrigger>
          <TabsTrigger value="dog" disabled={!isDog} className="text-xs sm:text-sm py-1 sm:py-2">
            <span className="hidden sm:inline">Dog Traits</span>
            <span className="sm:hidden">Dog</span>
          </TabsTrigger>
          <TabsTrigger value="cat" disabled={!isCat} className="text-xs sm:text-sm py-1 sm:py-2">
            <span className="hidden sm:inline">Cat Traits</span>
            <span className="sm:hidden">Cat</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="common" className="space-y-4 pt-2">
          <div className="space-y-6">
            {renderTraitSlider("energy", "Energy Level", "Low", "High")}
            {renderTraitSlider("sociability", "Sociability", "Independent", "Social")}
            {renderTraitSlider("confidence", "Confidence", "Timid", "Bold")}
          </div>
        </TabsContent>

        <TabsContent value="dog" className="space-y-4 pt-2">
          <div className="space-y-6">
            {renderTraitSlider("obedience", "Obedience", "Free-spirited", "Obedient")}
            {renderTraitSlider("playStyle", "Play Style", "Gentle", "Rough")}
          </div>
        </TabsContent>

        <TabsContent value="cat" className="space-y-4 pt-2">
          <div className="space-y-6">
            {renderTraitSlider("curiosity", "Curiosity", "Disinterested", "Curious")}
            {renderTraitSlider("territorial", "Territorial", "Accepting", "Territorial")}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
