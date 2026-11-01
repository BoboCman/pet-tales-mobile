"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/lib/supabase/provider"
import { RefreshCw, User, Database, Shield } from "lucide-react"

export function AuthDebug() {
  const { supabase } = useSupabase()
  const [sessionData, setSessionData] = useState<any>(null)
  const [userDetails, setUserDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const refreshAuthState = async () => {
    setLoading(true)
    try {
      // Get current session
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession()

      // Get user details
      const { data: userResult, error: userError } = await supabase.auth.getUser()

      setSessionData({
        session: sessionResult.session,
        error: sessionError,
        hasSession: !!sessionResult.session,
        userId: sessionResult.session?.user?.id,
        email: sessionResult.session?.user?.email,
        username: sessionResult.session?.user?.user_metadata?.username,
        expiresAt: sessionResult.session?.expires_at
          ? new Date(sessionResult.session.expires_at * 1000).toLocaleString()
          : null,
      })

      setUserDetails({
        user: userResult.user,
        error: userError,
        hasUser: !!userResult.user,
      })
    } catch (error) {
      console.error("Auth debug error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAuthState()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔐 AUTH DEBUG - Auth state changed:", event, !!session)
      refreshAuthState()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const testProtectedRoute = async () => {
    try {
      const { data, error } = await supabase.from("pets").select("*").limit(1)
      console.log("Protected route test:", { data, error })
      alert(`Protected route test: ${error ? `Error: ${error.message}` : `Success: ${data?.length || 0} pets`}`)
    } catch (error) {
      console.error("Protected route error:", error)
      alert(`Protected route error: ${error}`)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication Debug Panel
          </CardTitle>
          <CardDescription>Real-time authentication state monitoring and debugging tools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={refreshAuthState} disabled={loading} size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Auth State
            </Button>
            <Button onClick={testProtectedRoute} variant="outline" size="sm">
              <Database className="mr-2 h-4 w-4" />
              Test Protected Route
            </Button>
          </div>

          {/* Session Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="font-medium">Session Status</span>
              {sessionData?.hasSession ? (
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">No Session</Badge>
              )}
            </div>

            {sessionData && (
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Has Session:</span>
                  <span>{sessionData.hasSession ? "✅ Yes" : "❌ No"}</span>
                </div>

                {sessionData.hasSession && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">User ID:</span>
                      <span className="font-mono text-xs">{sessionData.userId}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Email:</span>
                      <span>{sessionData.email}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Username:</span>
                      <span>{sessionData.username || "Not set"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-medium">Expires At:</span>
                      <span className="text-xs">{sessionData.expiresAt}</span>
                    </div>
                  </>
                )}

                {sessionData.error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                    <strong>Session Error:</strong> {sessionData.error.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="font-medium">User Details</span>
              {userDetails?.hasUser ? (
                <Badge className="bg-green-100 text-green-800">Loaded</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800">No User</Badge>
              )}
            </div>

            {userDetails?.error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                <strong>User Error:</strong> {userDetails.error.message}
              </div>
            )}
          </div>

          {/* Raw Data (for debugging) */}
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">Raw Session Data</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
              {JSON.stringify({ sessionData, userDetails }, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
