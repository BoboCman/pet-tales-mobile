"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useSupabase } from "@/lib/supabase/provider"
import { AGES } from "@/lib/pets/options"
import { cleanQuirks, QUIRKS_MAX, traitQuestions, type PersonalityPet, type TraitKey } from "@/lib/pets/personality"

type QuizPet = PersonalityPet & { id: string; name: string; gender?: string | null; pet_age?: string | null }

/**
 * "Who is {name}, really?" Six one-tap questions instead of the slider form. Every answer
 * feeds the persona that writes the narration, so tales start sounding like this pet.
 */
export function PersonalityQuiz({ pet, next, welcome }: { pet: QuizPet; next?: string; welcome?: boolean }) {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const questions = useMemo(() => traitQuestions(pet.type), [pet.type])
  const ages = AGES[pet.type === "cat" ? "cat" : "dog"]

  const [answers, setAnswers] = useState<Partial<Record<TraitKey, number>>>(() => {
    const initial: Partial<Record<TraitKey, number>> = {}
    for (const q of questions) {
      const v = pet[q.key]
      if (typeof v === "number") initial[q.key] = v
    }
    return initial
  })
  const [age, setAge] = useState<string | null>(pet.pet_age ?? null)
  const [quirks, setQuirks] = useState(pet.personality_quirks ?? "")
  const [saving, setSaving] = useState(false)

  const pronoun = pet.gender === "female" ? "her" : pet.gender === "male" ? "him" : "them"
  const fill = (s: string) => s.replace(/\{name\}/g, pet.name)
  const leaveTo = next && next.startsWith("/") ? next : "/dashboard/pets"

  async function save() {
    setSaving(true)
    try {
      const update: Record<string, unknown> = { ...answers, updated_at: new Date().toISOString() }
      if (age) update.pet_age = age
      const cleaned = cleanQuirks(quirks)
      // Only send it when it changed, so saving still works before the column exists
      if (cleaned !== (pet.personality_quirks ?? null)) update.personality_quirks = cleaned
      const { error } = await supabase.from("pets").update(update).eq("id", pet.id)
      if (error) throw error
      toast({ title: `Got it. Next tale will sound more like ${pet.name}.` })
      router.push(leaveTo)
      router.refresh()
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      })
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-44 space-y-6">
      {!welcome && (
        <Link
          href={leaveTo}
          className="-ml-1 -mb-4 inline-flex h-9 items-center text-sm font-medium text-gray-500 active:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      )}
      <header className="text-center space-y-2">
        {welcome && <p className="text-sm font-semibold text-teal-700">{pet.name} is all set. One optional step:</p>}
        <div className="mx-auto h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-teal-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Who is {pet.name}, really?</h1>
        <p className="text-gray-600">
          Nobody knows {pronoun} like you do. Tap what fits and every tale is written in {pet.name}&apos;s own voice.
        </p>
      </header>

      {questions.map((q) => (
        <section key={q.key} className="space-y-2">
          <h2 className="font-semibold text-gray-900">{fill(q.question)}</h2>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt, i) => {
              const value = i + 1
              const selected = answers[q.key] === value
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: value }))}
                  aria-pressed={selected}
                  className={`min-h-[44px] px-3 py-2 rounded-full border text-sm transition-colors ${
                    selected
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "bg-white border-gray-200 text-gray-800 hover:border-teal-400"
                  }`}
                >
                  <span className="mr-1" aria-hidden>
                    {opt.emoji}
                  </span>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">How old is {pet.name}?</h2>
        <div className="flex flex-wrap gap-2">
          {ages.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAge(a.value)}
              aria-pressed={age === a.value}
              className={`min-h-[44px] px-3 py-2 rounded-full border text-sm transition-colors ${
                age === a.value
                  ? "bg-teal-600 border-teal-600 text-white"
                  : "bg-white border-gray-200 text-gray-800 hover:border-teal-400"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">
          Anything only you would know? <span className="font-normal text-gray-500">(optional)</span>
        </h2>
        <p className="text-sm text-gray-600">
          Nicknames, sworn enemies, favorite snack, weird habits. We&apos;ll slip them into the story.
        </p>
        <textarea
          value={quirks}
          onChange={(e) => setQuirks(e.target.value.slice(0, QUIRKS_MAX))}
          rows={3}
          maxLength={QUIRKS_MAX}
          placeholder={`e.g. Goes by "Mr. Wiggles". Sworn enemy: the vacuum. Would sell ${pronoun === "them" ? "their" : pronoun === "her" ? "her" : "his"} soul for cheese.`}
          className="w-full rounded-xl border border-gray-200 p-3 text-base focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        <p className="text-right text-xs text-gray-400">
          {quirks.length}/{QUIRKS_MAX}
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          <Button onClick={save} disabled={saving} className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save {pet.name}&apos;s personality
          </Button>
          {welcome && (
            <Link
              href={leaveTo}
              className="mt-2 flex h-10 items-center justify-center text-sm font-medium text-gray-500 active:text-gray-700"
            >
              Skip for now
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
