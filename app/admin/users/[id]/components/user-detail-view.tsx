"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  User,
  CreditCard,
  TrendingUp,
  Video,
  Eye,
  Heart,
  PawPrint,
  Gift,
  RefreshCw,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Edit,
} from "lucide-react"
import Link from "next/link"
import { GiftTalesCard } from "@/components/admin/gift-tales-card"
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog"
import { useRouter } from "next/navigation"

interface UserDetailData {
  user: {
    id: string
    email: string
    signupDate: string
    lastActive: string
    daysSinceSignup: number
    isActive: boolean
    isAdmin: boolean
  }
  credits: {
    free: number
    purchased: number
    total: number
    welcomeGranted: boolean
    lastWeeklyDate: string | null
  }
  subscription: {
    customerId: string | null
    status: string | null
    tier: string | null
  }
  transactions: Array<{
    id: string
    amount: number
    transaction_type: string
    created_at: string
    metadata: any
  }>
  pets: Array<{
    id: string
    name: string
    type: string
    breed: string
    avatar_url: string | null
    photo_url: string | null
    image_url: string | null
  }>
  videos: Array<{
    id: string
    title: string
    created_at: string
    view_count: number
    like_count: number
    is_public: boolean
    merged_video_url: string | null
    merged_video_supabase_url: string | null
    pets: {
      id: string
      name: string
      type: string
      avatar_url: string | null
      photo_url: string | null
      image_url: string | null
    } | null
  }>
  stats: {
    totalVideos: number
    totalViews: number
    totalLikes: number
    publicVideos: number
    privateVideos: number
    avgViewsPerVideo: number
  }
}

interface UserDetailViewProps {
  userId: string
  adminEmail: string
}

export default function UserDetailView({ userId, adminEmail }: UserDetailViewProps) {
  const [data, setData] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const { toast } = useToast()

  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "set">("add")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")

  const [transactionFilter, setTransactionFilter] = useState<string>("all")
  const [transactionPage, setTransactionPage] = useState(1)
  const transactionsPerPage = 10

  const fetchUserDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("User not found")
        }
        throw new Error("Failed to fetch user details")
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || "Failed to fetch user details")
      }
    } catch (error) {
      console.error("Error fetching user details:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load user details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreditAdjustment = async () => {
    if (!data) return

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

    if (adjustmentType === "remove" && amountNum > data.credits.total) {
      toast({
        title: "Error",
        description: `Cannot remove ${amountNum} credits. User only has ${data.credits.total} credits.`,
        variant: "destructive",
      })
      return
    }

    setAdjusting(true)
    try {
      const response = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: data.user.email,
          adjustmentType,
          amount: amountNum,
          reason: reason.trim(),
          adminEmail,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to adjust credits")
      }

      toast({
        title: "Success",
        description: `Credits adjusted from ${result.previousBalance} to ${result.newBalance}`,
      })

      // Reset form and refresh data
      setAmount("")
      setReason("")
      setAdjustmentType("add")
      await fetchUserDetail()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust credits",
        variant: "destructive",
      })
    } finally {
      setAdjusting(false)
    }
  }

  const calculateNewBalance = () => {
    if (!data) return 0
    const amountNum = Number.parseInt(amount) || 0
    if (adjustmentType === "add") return data.credits.total + amountNum
    if (adjustmentType === "remove") return Math.max(0, data.credits.total - amountNum)
    return amountNum // 'set'
  }

  const filteredTransactions =
    data?.transactions.filter((tx) => {
      if (transactionFilter === "all") return true
      return tx.transaction_type === transactionFilter
    }) || []

  const paginatedTransactions = filteredTransactions.slice(
    (transactionPage - 1) * transactionsPerPage,
    transactionPage * transactionsPerPage,
  )

  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage)

  const getTransactionBadge = (type: string, metadata?: any) => {
    // Several kinds of rows share a type; metadata says which one it is
    if (type === "grant" && metadata?.gift) {
      return <Badge className="bg-teal-100 text-teal-700">Gift</Badge>
    }
    if (type === "grant" && metadata?.subscription) {
      return <Badge className="bg-teal-100 text-teal-700">Plan renewal</Badge>
    }
    if (type === "adjustment" && metadata?.reason === "stripe_refund") {
      return <Badge className="bg-red-100 text-red-700">Stripe refund</Badge>
    }
    if (type === "adjustment" && metadata?.reason === "stripe_dispute") {
      return <Badge className="bg-red-100 text-red-700">Chargeback</Badge>
    }
    if (type === "adjustment" && metadata?.reason === "legacy_credit_cleanup_2026_11_07") {
      return <Badge className="bg-gray-100 text-gray-700">Legacy cleanup</Badge>
    }
    const badges: Record<string, { label: string; className: string }> = {
      welcome: { label: "Signup tale", className: "bg-green-100 text-green-700" },
      weekly: { label: "Weekly free (legacy)", className: "bg-gray-100 text-gray-700" },
      purchase: { label: "Pack purchase", className: "bg-blue-100 text-blue-700" },
      deduction: { label: "Used", className: "bg-red-100 text-red-700" },
      refund: { label: "Tale returned", className: "bg-green-100 text-green-700" },
      grant: { label: "Admin grant", className: "bg-teal-100 text-teal-700" },
      adjustment: { label: "Admin adjustment", className: "bg-orange-100 text-orange-700" },
    }
    const badge = badges[type] || { label: type, className: "bg-gray-100 text-gray-700" }
    return <Badge className={badge.className}>{badge.label}</Badge>
  }

  const router = useRouter()
  const deleteUser = async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: "DELETE" }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return result.error || "Delete failed"
      toast({
        title: "User deleted",
        description: `${result.cancelledSubscriptions ? "Plan cancelled. " : ""}${result.deletedTales} private tales deleted, ${result.keptPublicTales} public kept.`,
      })
      router.push("/admin/users")
      return null
    } catch {
      return "Delete failed"
    }
  }

  useEffect(() => {
    fetchUserDetail()
  }, [userId])

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading user details...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <p className="mt-4 text-gray-600">User not found</p>
        <Button onClick={fetchUserDetail} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchUserDetail} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-teal-600" />
              User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-semibold text-lg break-all">{data.user.email}</div>
              {data.user.isAdmin && <Badge className="mt-1 bg-purple-100 text-purple-700">Admin</Badge>}
            </div>
            <div>
              <div className="text-sm text-gray-500">Signup Date</div>
              <div className="font-medium">{new Date(data.user.signupDate).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">{data.user.daysSinceSignup} days ago</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Last Active</div>
              <div className="font-medium">{new Date(data.user.lastActive).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Activity Status</div>
              {data.user.isActive ? (
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                  Inactive
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Credit Balance Card */}
        <Card className="border-teal-200 dark:border-teal-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-teal-600" />
              Tales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Tales left</div>
              <div className="text-4xl font-bold text-teal-600">{data.credits.total}</div>
            </div>
            <div className="text-sm text-gray-600">
              Free/plan: {data.credits.free} • Packs/gifts: {data.credits.purchased}
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Plan: </span>
              <span className="font-medium">
                {data.subscription.status && data.subscription.tier && data.subscription.tier !== "free"
                  ? `${data.subscription.tier.replace("_", " ")} (${data.subscription.status})`
                  : "None"}
              </span>
              {data.subscription.customerId && (
                <a
                  href={`https://dashboard.stripe.com/customers/${data.subscription.customerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-teal-600 underline underline-offset-4"
                >
                  Open in Stripe
                </a>
              )}
            </div>
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all"
                  style={{
                    width: data.credits.total > 0 ? `${(data.credits.free / data.credits.total) * 100}%` : "0%",
                  }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {data.credits.total > 0 ? Math.round((data.credits.free / data.credits.total) * 100) : 0}% free credits
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs text-gray-500">Welcome Credits</div>
              {data.credits.welcomeGranted ? (
                <Badge className="bg-green-100 text-green-700">Granted</Badge>
              ) : (
                <Badge variant="secondary">Not Granted</Badge>
              )}
            </div>
            {data.credits.lastWeeklyDate && (
              <div>
                <div className="text-xs text-gray-500">Last Weekly Credit</div>
                <div className="text-sm">{new Date(data.credits.lastWeeklyDate).toLocaleDateString()}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-gray-500">
                  <Video className="h-4 w-4" />
                  <span className="text-xs">Videos</span>
                </div>
                <div className="text-2xl font-bold">{data.stats.totalVideos}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-gray-500">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">Views</span>
                </div>
                <div className="text-2xl font-bold">{data.stats.totalViews}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-gray-500">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">Likes</span>
                </div>
                <div className="text-2xl font-bold">{data.stats.totalLikes}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-gray-500">
                  <PawPrint className="h-4 w-4" />
                  <span className="text-xs">Pets</span>
                </div>
                <div className="text-2xl font-bold">{data.pets.length}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Public Videos</span>
                <span className="font-medium">{data.stats.publicVideos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Private Videos</span>
                <span className="font-medium">{data.stats.privateVideos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg Views/Video</span>
                <span className="font-medium">{data.stats.avgViewsPerVideo}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <GiftTalesCard userId={data.user.id} email={data.user.email} onGifted={fetchUserDetail} />

      <Card className="border-teal-200 dark:border-teal-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-teal-600" />
            Adjust tales (advanced)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current User Display */}
          <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
            <div className="text-sm text-gray-600 dark:text-gray-400">Managing Credits For</div>
            <div className="text-lg font-semibold text-teal-700 dark:text-teal-400">{data.user.email}</div>
            <div className="text-sm text-gray-600 mt-1">
              Current Balance: <span className="font-bold text-teal-600">{data.credits.total} credits</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Free: {data.credits.free} • Purchased: {data.credits.purchased}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Adjustment Type */}
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <RadioGroup
                  value={adjustmentType}
                  onValueChange={(v: any) => setAdjustmentType(v)}
                  disabled={adjusting}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="add" id="add" />
                    <Label
                      htmlFor="add"
                      className="text-green-600 dark:text-green-400 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Credits
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remove" id="remove" />
                    <Label
                      htmlFor="remove"
                      className="text-red-600 dark:text-red-400 cursor-pointer flex items-center gap-1"
                    >
                      <Minus className="h-4 w-4" />
                      Remove Credits
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="set" id="set" />
                    <Label
                      htmlFor="set"
                      className="text-blue-600 dark:text-blue-400 cursor-pointer flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
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
                  disabled={adjusting}
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
                  disabled={adjusting}
                />
                <p className="text-xs text-gray-500">Minimum 10 characters for audit trail</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* New Balance Preview */}
              {amount && Number.parseInt(amount) > 0 && (
                <div className="p-6 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-lg border-2 border-teal-300 dark:border-teal-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">New Balance Preview</div>
                  <div className="text-5xl font-bold text-teal-600 mb-2">{calculateNewBalance()}</div>
                  <div className="text-sm text-gray-600">
                    {adjustmentType === "add" && <span className="text-green-600 font-medium">+{amount} credits</span>}
                    {adjustmentType === "remove" && <span className="text-red-600 font-medium">-{amount} credits</span>}
                    {adjustmentType === "set" && (
                      <span className="text-blue-600 font-medium">Set to {amount} credits</span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleCreditAdjustment}
                  disabled={adjusting || !reason || !amount || Number.parseInt(amount) <= 0}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  size="lg"
                >
                  {adjusting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Adjust Credits
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAmount("")
                    setReason("")
                    setAdjustmentType("add")
                  }}
                  disabled={adjusting}
                  className="w-full"
                >
                  Clear Form
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Credit Transaction History</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter" className="text-sm text-gray-500">
                Filter:
              </Label>
              <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                <SelectTrigger id="filter" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="welcome">Signup tale</SelectItem>
                  <SelectItem value="purchase">Pack purchase</SelectItem>
                  <SelectItem value="deduction">Used</SelectItem>
                  <SelectItem value="grant">Grants and renewals</SelectItem>
                  <SelectItem value="adjustment">Adjustments and refunds</SelectItem>
                  <SelectItem value="refund">Tale returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason/Notes</TableHead>
                      <TableHead>Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">
                          {new Date(tx.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>{getTransactionBadge(tx.transaction_type, tx.metadata)}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={tx.amount > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {tx.metadata?.reason || tx.metadata?.pack_type || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{tx.metadata?.admin_email || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Showing {(transactionPage - 1) * transactionsPerPage + 1} to{" "}
                    {Math.min(transactionPage * transactionsPerPage, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                      disabled={transactionPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTransactionPage((p) => Math.min(totalPages, p + 1))}
                      disabled={transactionPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {transactionFilter === "all" ? "No transactions yet" : `No ${transactionFilter} transactions`}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Videos List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-teal-600" />
              Videos ({data.videos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.videos.length > 0 ? (
              <div className="space-y-3">
                {data.videos.slice(0, 10).map((video) => (
                  <div
                    key={video.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="h-16 w-16 rounded bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {video.pets?.avatar_url || video.pets?.photo_url || video.pets?.image_url ? (
                        <img
                          src={video.pets.avatar_url || video.pets.photo_url || video.pets.image_url || ""}
                          alt={video.pets.name || "Pet"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Video className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{video.title || "Untitled"}</div>
                      <div className="text-sm text-gray-500">{video.pets?.name || "Unknown Pet"}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                        <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {video.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {video.like_count || 0}
                        </span>
                        {video.is_public ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Public</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/admin/videos/${video.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
                {data.videos.length > 10 && (
                  <div className="text-center text-sm text-gray-500 pt-2">
                    Showing 10 of {data.videos.length} videos
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Video className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No videos yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="h-5 w-5 text-teal-600" />
              Pets ({data.pets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.pets.length > 0 ? (
              <div className="space-y-3">
                {data.pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {pet.avatar_url || pet.photo_url || pet.image_url ? (
                        <img
                          src={pet.avatar_url || pet.photo_url || pet.image_url || ""}
                          alt={pet.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PawPrint className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg">{pet.name}</div>
                      <div className="text-sm text-gray-600">{pet.type}</div>
                      {pet.breed && <div className="text-xs text-gray-500 truncate">{pet.breed}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <PawPrint className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No pets yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!data.user.isAdmin && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-300">Delete user</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-sm text-gray-600 max-w-2xl">
              For a deletion request by email. Cancels any Stripe plan now (no refund), deletes their login, pets and
              private tales, and emails them a confirmation. Public tales stay up at their links.
            </p>
            <DeleteAccountDialog
              title={`Delete ${data.user.email}?`}
              triggerLabel="Delete user"
              confirmLabel="Delete user"
              onConfirm={deleteUser}
              description={<p>This can&apos;t be undone.</p>}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
