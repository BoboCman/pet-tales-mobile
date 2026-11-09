"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2 } from "lucide-react"

/** "Type DELETE to confirm" dialog, shared by Settings and Admin → Users. */
export function DeleteAccountDialog({
  title,
  description,
  triggerLabel,
  confirmLabel,
  onConfirm,
  trigger,
}: {
  title: string
  description: React.ReactNode
  triggerLabel: string
  confirmLabel: string
  /** Returns an error message, or null on success */
  onConfirm: () => Promise<string | null>
  /** Custom trigger element; defaults to a red button */
  trigger?: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const message = await onConfirm()
    setBusy(false)
    if (message) setError(message)
    else setOpen(false)
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
        if (!next) {
          setTyped("")
          setError(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" size="sm" className="w-full sm:w-auto sm:min-w-[140px]">
            <Trash2 className="h-4 w-4 mr-2" />
            {triggerLabel}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            disabled={busy}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={busy || typed.trim() !== "DELETE"}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {busy ? "Deleting…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
