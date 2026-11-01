"use server"

export async function recordUserConsent(email: string, userAgent: string, referrer: string) {
  try {
    // In a real app, you would save this to your database
    // For now, we'll just log it and return success
    console.log("Recording consent for:", { email, userAgent, referrer, timestamp: new Date().toISOString() })

    return { success: true }
  } catch (error) {
    console.error("Error recording consent:", error)
    return { success: false, error: "Failed to record consent" }
  }
}
