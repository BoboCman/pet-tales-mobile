"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signUpWithEmail(formData: FormData) {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  console.log("🔐 AUTH ACTION - Starting signup for username:", username)

  if (!username || !password) {
    return { error: "Username and password are required" }
  }

  // Validate username format
  if (username.length < 3 || username.length > 20) {
    return { error: "Username must be between 3 and 20 characters" }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: "Username can only contain letters, numbers, underscores, and dashes" }
  }

  try {
    const supabase = await createClient()

    // Convert username to email format for Supabase
    const email = `${username.toLowerCase()}@pettales.local`

    console.log("🔐 AUTH ACTION - Generated email:", email)

    // Sign up without email confirmation, including username in metadata
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Remove email verification
        data: {
          username: username,
          display_name: username,
        },
      },
    })

    if (signUpError) {
      console.error("🔐 AUTH ACTION - Signup error:", signUpError.message)

      // Convert email-related errors to username-friendly messages
      let errorMessage = signUpError.message
      if (errorMessage.toLowerCase().includes("email")) {
        if (errorMessage.includes("already registered") || errorMessage.includes("already exists")) {
          errorMessage = "This username is already taken. Please choose a different username."
        } else {
          errorMessage = errorMessage.replace(/email/gi, "username")
        }
      }

      return { error: errorMessage }
    }

    // Immediately sign in the user after signup
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      console.error("🔐 AUTH ACTION - Sign in after signup error:", signInError.message)
      return { error: "Account created but sign in failed. Please try signing in manually." }
    }

    console.log("🔐 AUTH ACTION - User signup and signin successful")

    // Create user profile in users table
    if (signInData.user) {
      const { error: profileError } = await supabase.from("users").upsert({
        id: signInData.user.id,
        username: username,
        full_name: username,
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        console.error("🔐 AUTH ACTION - Profile creation error:", profileError)
        // Don't fail the signup for profile errors
      }
    }

    // Return success with complete session data
    return {
      success: true,
      session: signInData.session,
      user: signInData.user,
    }
  } catch (error) {
    console.error("🔐 AUTH ACTION - Signup error:", error)
    return { error: "An unexpected error occurred during signup" }
  }
}

export async function signInWithEmail(formData: FormData) {
  const username = formData.get("username") as string
  const password = formData.get("password") as string

  console.log("🔐 AUTH ACTION - Starting signin for username:", username)

  if (!username || !password) {
    return { error: "Username and password are required" }
  }

  try {
    const supabase = await createClient()

    // Convert username to email format for Supabase
    const email = `${username.toLowerCase()}@pettales.local`

    console.log("🔐 AUTH ACTION - Generated email:", email)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("🔐 AUTH ACTION - Login error:", error.message)

      // Convert email-related errors to username-friendly messages
      let errorMessage = error.message
      if (errorMessage.toLowerCase().includes("email")) {
        if (errorMessage.includes("not confirmed") || errorMessage.includes("confirm")) {
          errorMessage = "Please check your username and password and try again."
        } else if (errorMessage.includes("invalid") || errorMessage.includes("wrong")) {
          errorMessage = "Invalid username or password. Please try again."
        } else {
          errorMessage = errorMessage.replace(/email/gi, "username")
        }
      }

      return { error: errorMessage }
    }

    console.log("🔐 AUTH ACTION - User login successful")

    // Return success with complete session data
    return {
      success: true,
      session: data.session,
      user: data.user,
    }
  } catch (error) {
    console.error("🔐 AUTH ACTION - Login error:", error)
    return { error: "An unexpected error occurred during login" }
  }
}

export async function signOut() {
  console.log("🔐 AUTH ACTION - Starting signout")
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("🔐 AUTH ACTION - Signout error:", error)
    return { error: "Failed to sign out" }
  }

  console.log("🔐 AUTH ACTION - Signout complete")
  redirect("/")
}
