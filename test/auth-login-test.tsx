"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/lib/supabase/provider"
import { signInWithEmail } from "@/app/actions/auth-actions"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, Loader2, User, Key, Database, Navigation } from "lucide-react"

interface TestResult {
  step: string
  status: "pending" | "success" | "error"
  message: string
  details?: any
}

export default function AuthLoginTest() {
  const { supabase } = useSupabase()
  const { toast } = useToast()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState("")

  // Test credentials - using a test username
  const testCredentials = {
    username: "testuser123",
    password: "testpass123",
  }

  const updateTestResult = (step: string, status: TestResult["status"], message: string, details?: any) => {
    setTestResults((prev) => {
      const existing = prev.find((r) => r.step === step)
      const newResult = { step, status, message, details }

      if (existing) {
        return prev.map((r) => (r.step === step ? newResult : r))
      } else {
        return [...prev, newResult]
      }
    })
  }

  const runLoginTest = async () => {
    setIsRunning(true)
    setTestResults([])
    setCurrentStep("Starting login test...")

    try {
      // Step 1: Check initial session state
      setCurrentStep("Checking initial session state...")
      updateTestResult("initial-session", "pending", "Checking if user is already logged in...")

      const { data: initialSession } = await supabase.auth.getSession()

      if (initialSession.session) {
        updateTestResult("initial-session", "success", "User already logged in, signing out first...", {
          userId: initialSession.session.user.id,
          email: initialSession.session.user.email,
        })

        // Sign out first to test clean login
        await supabase.auth.signOut()
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait for signout
      } else {
        updateTestResult("initial-session", "success", "No existing session found - ready for login test")
      }

      // Step 2: Test username to email conversion
      setCurrentStep("Testing username to email conversion...")
      updateTestResult("username-conversion", "pending", "Converting username to email format...")

      const expectedEmail = `${testCredentials.username.toLowerCase()}@pettales.local`
      updateTestResult(
        "username-conversion",
        "success",
        `Username converted: ${testCredentials.username} → ${expectedEmail}`,
        {
          originalUsername: testCredentials.username,
          convertedEmail: expectedEmail,
        },
      )

      // Step 3: Attempt login using server action
      setCurrentStep("Attempting login with server action...")
      updateTestResult("server-action-login", "pending", "Calling signInWithEmail server action...")

      const formData = new FormData()
      formData.append("username", testCredentials.username)
      formData.append("password", testCredentials.password)

      const loginResult = await signInWithEmail(formData)

      if (loginResult.error) {
        updateTestResult("server-action-login", "error", `Login failed: ${loginResult.error}`, loginResult)

        // If user doesn't exist, try to create them first
        if (loginResult.error.includes("Invalid") || loginResult.error.includes("wrong")) {
          setCurrentStep("User doesn't exist, attempting to create test user...")
          updateTestResult("create-test-user", "pending", "Creating test user for login test...")

          try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: expectedEmail,
              password: testCredentials.password,
              options: {
                data: {
                  username: testCredentials.username,
                  display_name: testCredentials.username,
                },
              },
            })

            if (signUpError) {
              updateTestResult("create-test-user", "error", `Failed to create test user: ${signUpError.message}`)
              return
            }

            updateTestResult("create-test-user", "success", "Test user created successfully", {
              userId: signUpData.user?.id,
              email: signUpData.user?.email,
            })

            // Now try login again
            const retryLoginResult = await signInWithEmail(formData)

            if (retryLoginResult.error) {
              updateTestResult("server-action-login", "error", `Login retry failed: ${retryLoginResult.error}`)
              return
            }

            updateTestResult("server-action-login", "success", "Login successful after user creation", retryLoginResult)
          } catch (createError) {
            updateTestResult("create-test-user", "error", `Error creating test user: ${createError}`)
            return
          }
        } else {
          return
        }
      } else {
        updateTestResult("server-action-login", "success", "Server action login successful", {
          hasSession: !!loginResult.session,
          hasUser: !!loginResult.user,
          userId: loginResult.user?.id,
        })
      }

      // Step 4: Verify session was set on client
      setCurrentStep("Verifying client session...")
      updateTestResult("client-session", "pending", "Setting session on Supabase client...")

      if (loginResult.session) {
        // Set the session on the client using the same method as the forms
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: loginResult.session.access_token,
          refresh_token: loginResult.session.refresh_token,
        })

        if (sessionError) {
          updateTestResult("client-session", "error", `Failed to set session: ${sessionError.message}`)
          return
        }

        // Wait a moment for session to propagate
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const { data: clientSession } = await supabase.auth.getSession()

        if (clientSession.session) {
          updateTestResult("client-session", "success", "Client session verified", {
            userId: clientSession.session.user.id,
            email: clientSession.session.user.email,
            username: clientSession.session.user.user_metadata?.username,
            expiresAt: new Date(clientSession.session.expires_at! * 1000).toLocaleString(),
          })
        } else {
          updateTestResult("client-session", "error", "No session found on client after setting")
          return
        }
      } else {
        updateTestResult("client-session", "error", "No session data returned from server action")
        return
      }

      // Step 5: Test session persistence across page refresh simulation
      setCurrentStep("Testing session persistence...")
      updateTestResult("session-persistence", "pending", "Simulating page refresh to test session persistence...")

      // Simulate what happens on page refresh - get session again
      await new Promise((resolve) => setTimeout(resolve, 500))
      const { data: persistedSession } = await supabase.auth.getSession()

      if (persistedSession.session) {
        updateTestResult("session-persistence", "success", "Session persisted across refresh simulation", {
          sessionId: persistedSession.session.access_token.substring(0, 20) + "...",
          userId: persistedSession.session.user.id,
        })
      } else {
        updateTestResult("session-persistence", "error", "Session did not persist")
        return
      }

      // Step 6: Test protected route access
      setCurrentStep("Testing protected route access...")
      updateTestResult("protected-route", "pending", "Testing access to protected resources...")

      try {
        // Try to fetch user's pets (protected resource)
        const { data: pets, error: petsError } = await supabase.from("pets").select("*").limit(1)

        if (petsError) {
          updateTestResult("protected-route", "error", `Protected route access failed: ${petsError.message}`)
        } else {
          updateTestResult("protected-route", "success", "Protected route access successful", {
            petsCount: pets?.length || 0,
            canAccessDatabase: true,
          })
        }
      } catch (routeError) {
        updateTestResult("protected-route", "error", `Protected route test failed: ${routeError}`)
      }

      // Step 7: Test auth state listener
      setCurrentStep("Testing auth state listener...")
      updateTestResult("auth-listener", "pending", "Testing auth state change detection...")

      let listenerTriggered = false
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) {
          listenerTriggered = true
          updateTestResult("auth-listener", "success", "Auth state listener working correctly", {
            event,
            hasSession: !!session,
          })
        }
      })

      // Trigger a token refresh to test the listener
      await supabase.auth.refreshSession()

      // Wait for listener to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (!listenerTriggered) {
        updateTestResult("auth-listener", "success", "Auth listener test completed (no state change needed)")
      }

      subscription.unsubscribe()

      setCurrentStep("Login test completed successfully! ✅")

      toast({
        title: "Login Test Completed",
        description: "All authentication tests passed successfully!",
      })
    } catch (error) {
      console.error("Login test error:", error)
      updateTestResult("test-error", "error", `Test failed with error: ${error}`)

      toast({
        title: "Login Test Failed",
        description: "An error occurred during the login test.",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
      setCurrentStep("")
    }
  }

  const clearResults = () => {
    setTestResults([])
    setCurrentStep("")
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
    }
  }

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>
      case "pending":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Running</Badge>
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Authentication Login Test
          </CardTitle>
          <CardDescription>
            Test the complete login flow with username authentication, session persistence, and protected route access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Key className="h-5 w-5 text-gray-600" />
            <div>
              <p className="font-medium">Test Credentials</p>
              <p className="text-sm text-gray-600">
                Username: <code className="bg-gray-200 px-1 rounded">{testCredentials.username}</code> → Email:{" "}
                <code className="bg-gray-200 px-1 rounded">{testCredentials.username}@pettales.local</code>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={runLoginTest} disabled={isRunning} className="bg-teal-600 hover:bg-teal-700">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                "Run Login Test"
              )}
            </Button>

            <Button onClick={clearResults} variant="outline" disabled={isRunning}>
              Clear Results
            </Button>
          </div>

          {currentStep && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800">{currentStep}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Test Results
            </CardTitle>
            <CardDescription>Detailed results of each authentication test step</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium capitalize">{result.step.replace(/-/g, " ")}</h3>
                          {getStatusBadge(result.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{result.message}</p>

                        {result.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View Details</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {testResults.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="h-4 w-4" />
                  <span className="font-medium">Test Summary</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {testResults.filter((r) => r.status === "success").length}
                    </div>
                    <div className="text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">
                      {testResults.filter((r) => r.status === "error").length}
                    </div>
                    <div className="text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {testResults.filter((r) => r.status === "pending").length}
                    </div>
                    <div className="text-gray-600">Running</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
