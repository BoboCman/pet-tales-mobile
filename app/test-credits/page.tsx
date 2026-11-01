"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getUserCredits,
  deductCredit,
  grantWelcomeCredits,
  grantWeeklyCredit,
  getCreditTransactionHistory,
} from "@/lib/credits/operations"

export default function TestCreditsPage() {
  const [userId, setUserId] = useState("395247d6-5c4a-4402-8d48-005658735fba")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string>("")

  const handleGetCredits = async () => {
    setLoading(true)
    setLastAction("getUserCredits")
    try {
      const res = await getUserCredits(userId)
      setResult(res)
    } catch (error) {
      setResult({ data: null, error: error instanceof Error ? error : new Error("Unknown error") })
    } finally {
      setLoading(false)
    }
  }

  const handleGrantWelcome = async () => {
    setLoading(true)
    setLastAction("grantWelcomeCredits")
    try {
      const res = await grantWelcomeCredits(userId)
      setResult(res)
    } catch (error) {
      setResult({ data: null, error: error instanceof Error ? error : new Error("Unknown error") })
    } finally {
      setLoading(false)
    }
  }

  const handleDeductCredit = async () => {
    setLoading(true)
    setLastAction("deductCredit")
    try {
      const res = await deductCredit(userId)
      setResult(res)
    } catch (error) {
      setResult({ data: null, error: error instanceof Error ? error : new Error("Unknown error") })
    } finally {
      setLoading(false)
    }
  }

  const handleGrantWeekly = async () => {
    setLoading(true)
    setLastAction("grantWeeklyCredit")
    try {
      const res = await grantWeeklyCredit(userId)
      setResult(res)
    } catch (error) {
      setResult({ data: null, error: error instanceof Error ? error : new Error("Unknown error") })
    } finally {
      setLoading(false)
    }
  }

  const handleViewHistory = async () => {
    setLoading(true)
    setLastAction("getCreditTransactionHistory")
    try {
      const res = await getCreditTransactionHistory(userId)
      setResult(res)
    } catch (error) {
      setResult({ data: null, error: error instanceof Error ? error : new Error("Unknown error") })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Credit Operations Test Page</h1>
          <p className="text-muted-foreground">Test credit operations in production environment</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test User ID</CardTitle>
            <CardDescription>Enter the UUID of the user you want to test</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User UUID"
              className="font-mono"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Operations</CardTitle>
            <CardDescription>Click any button to test the corresponding credit operation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Button onClick={handleGetCredits} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading && lastAction === "getUserCredits" ? "Loading..." : "Get Credits"}
              </Button>
              <Button onClick={handleGrantWelcome} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading && lastAction === "grantWelcomeCredits" ? "Loading..." : "Grant Welcome Credits"}
              </Button>
              <Button onClick={handleDeductCredit} disabled={loading} className="bg-red-600 hover:bg-red-700">
                {loading && lastAction === "deductCredit" ? "Loading..." : "Deduct Credit"}
              </Button>
              <Button onClick={handleGrantWeekly} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                {loading && lastAction === "grantWeeklyCredit" ? "Loading..." : "Grant Weekly Credit"}
              </Button>
              <Button
                onClick={handleViewHistory}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 sm:col-span-2 lg:col-span-1"
              >
                {loading && lastAction === "getCreditTransactionHistory" ? "Loading..." : "View Transaction History"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Result: {lastAction}</CardTitle>
              <CardDescription>
                {result.error ? (
                  <span className="text-red-600">Error occurred</span>
                ) : (
                  <span className="text-green-600">Success</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
