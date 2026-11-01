import { cookies } from "next/headers"

export function getServerSessionId(): string {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get("pt_session")

    if (sessionCookie?.value) {
      return sessionCookie.value
    }

    // Fallback if cookie not found (shouldn't happen with middleware)
    return `server_fallback_${crypto.randomUUID()}`
  } catch (error) {
    console.error("Error reading session cookie:", error)
    return `server_error_${crypto.randomUUID()}`
  }
}
