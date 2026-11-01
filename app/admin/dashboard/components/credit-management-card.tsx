"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, Gift } from "lucide-react"

interface CreditManagementCardProps {
  adminEmail: string
}

interface UserData {
  id: string
  email: string
  free_credits: number
  purchased_credits: number
}

export function CreditManagementCard({ adminEmail }: CreditManagementCardProps) {
  const { toast } = useToast()
  const [userEmail, setUserEmail] = useState("")
  const [user, setUser] = useState<UserData | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "set">("add")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const currentBalance = user ? user.free_credits + user.purchased_credits : 0

  const calculateNewBalance = () => {
    const amountNum = Number.parseInt(amount) || 0
    if (adjustmentType === "add") return currentBalance + amountNum
    if (adjustmentType === "remove") return Math.max(0, currentBalance - amountNum)
    return amountNum // 'set'
  }

  const handleSearch = async () => {
    if (!userEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter a user email",
        variant: "destructive",
      })
      return
    }

    setSearching(true)
    try {
      const response = await fetch("/api/admin/credits/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to find user")
      }

      setUser(data.user)
      toast({
        title: "User found",
        description: `${data.user.email} has ${data.user.free_credits + data.user.purchased_credits} credits`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to find user",
        variant: "destructive",
      })
      setUser(null)
    } finally {
      setSearching(false)
    }
  }

  const handleAdjust = async () => {
    if (!user) return

    const amountNum = Number.parseInt(amount)
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      })
      return
    }

    if (!reason.trim() || reason.trim().length < 10) {
      toast({
        title: "Error",
        description: "Please provide a reason (at least 10 characters)",
        variant: "destructive",
      })
      return
    }

    if (adjustmentType === "remove" && amountNum > currentBalance) {
      toast({
        title: "Error",
        description: `Cannot remove ${amountNum} credits. User only has ${currentBalance} credits.`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user.email,
          adjustmentType,
          amount: amountNum,
          reason: reason.trim(),
          adminEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to adjust credits")
      }

      toast({
        title: "Success",
        description: `Credits adjusted from ${data.previousBalance} to ${data.newBalance}`,
      })

      // Reset form
      setUser(null)
      setUserEmail("")
      setAmount("")
      setReason("")
      setAdjustmentType("add")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust credits",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-teal-200 dark:border-teal-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-teal-600" />
          Quick Credit Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search User */}
        <div className="space-y-2">
          <Label htmlFor="userEmail">Search User</Label>
          <div className="flex gap-2">
            <Input
              id="userEmail"
              type="email"
              placeholder="user@example.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              disabled={loading || searching}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSearch()
                }
              }}
            />
            <Button onClick={handleSearch} disabled={loading || searching} className="bg-teal-600 hover:bg-teal-700">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {user && (
          <>
            {/* Current Balance */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400">Current Balance</div>
              <div className="text-2xl font-bold text-teal-600">{currentBalance} credits</div>
              <div className="text-xs text-gray-500 mt-1">
                Free: {user.free_credits} • Purchased: {user.purchased_credits}
              </div>
            </div>

            {/* Adjustment Type */}
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <RadioGroup value={adjustmentType} onValueChange={(v: any) => setAdjustmentType(v)} disabled={loading}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" />
                  <Label htmlFor="add" className="text-green-600 dark:text-green-400 cursor-pointer">
                    Add Credits
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remove" id="remove" />
                  <Label htmlFor="remove" className="text-red-600 dark:text-red-400 cursor-pointer">
                    Remove Credits
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="set" id="set" />
                  <Label htmlFor="set" className="text-blue-600 dark:text-blue-400 cursor-pointer">
                    Set To Amount
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you're adjusting credits..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">Minimum 10 characters for audit trail</p>
            </div>

            {/* New Balance Preview */}
            {amount && Number.parseInt(amount) > 0 && (
              <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border-2 border-teal-200 dark:border-teal-800">
                <div className="text-sm text-gray-600 dark:text-gray-400">New Balance</div>
                <div className="text-2xl font-bold text-teal-600">{calculateNewBalance()} credits</div>
                <div className="text-xs text-gray-500 mt-1">
                  {adjustmentType === "add" && `+${amount} credits`}
                  {adjustmentType === "remove" && `-${amount} credits`}
                  {adjustmentType === "set" && `Set to ${amount} credits`}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUser(null)
                  setUserEmail("")
                  setAmount("")
                  setReason("")
                }}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdjust}
                disabled={loading || !reason || !amount || Number.parseInt(amount) <= 0}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Adjust Credits"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default CreditManagementCard
