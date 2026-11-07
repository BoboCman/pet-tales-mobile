"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Gift, Loader2 } from "lucide-react"

const QUICK_REASONS = ["Not happy with a tale", "Tale failed to process", "Thank you / goodwill"]

/** One-click goodwill gift: adds tales that never expire and can email the user. */
export function GiftTalesCard({ userId, email, onGifted }: { userId: string; email: string; onGifted: () => void }) {
  const [tales, setTales] = useState(1)
  const [reason, setReason] = useState(QUICK_REASONS[0])
  const [note, setNote] = useState("")
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const gift = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/admin/credits/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tales, reason, note, notify }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gift failed")

      const emailStatus = !notify
        ? "No email sent."
        : data.email?.sent
          ? "We emailed them."
          : `Email not sent (${data.email?.skipped || data.email?.error || "unknown"}).`
      toast({ title: `Gifted ${tales} ${tales === 1 ? "tale" : "tales"}`, description: `${email} now has ${data.newTotal}. ${emailStatus}` })
      setNote("")
      onGifted()
    } catch (error) {
      toast({
        title: "Couldn't gift tales",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-teal-200 dark:border-teal-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-teal-600" />
          Gift tales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>
              {r}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
          <div className="space-y-1">
            <Label htmlFor="gift-tales">Tales</Label>
            <Input
              id="gift-tales"
              type="number"
              min={1}
              max={20}
              value={tales}
              onChange={(e) => setTales(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gift-reason">Reason (internal)</Label>
            <Input id="gift-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="gift-note">Note to the user (optional, shown in the email)</Label>
          <Textarea
            id="gift-note"
            rows={2}
            placeholder="Sorry that last tale didn't come out right. Here's one on us!"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="gift-notify" checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
          <Label htmlFor="gift-notify" className="font-normal">
            Email {email} to let them know
          </Label>
        </div>
        <Button onClick={gift} disabled={busy || reason.trim().length < 3} className="bg-teal-600 hover:bg-teal-700">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
          Gift {tales} {tales === 1 ? "tale" : "tales"}
        </Button>
        <p className="text-xs text-gray-500">Gifted tales never expire. Refunds of money are done in Stripe.</p>
      </CardContent>
    </Card>
  )
}
