/**
 * Admin two-factor login (authenticator app codes, Supabase MFA).
 *
 * Signing in with a password gives a session at assurance level "aal1". Entering a 6-digit
 * authenticator code on /admin/mfa raises the same session to "aal2". The admin panel and the
 * admin APIs require aal2, so a stolen password alone can't reach them. Regular app pages
 * don't look at this at all.
 *
 * The level is read from the session's access token. Callers only trust it after the same
 * token has been checked by Supabase (getUser(), or a database query made with it).
 */

export const ADMIN_MFA_PATH = "/admin/mfa"

/** The "aal" claim of a Supabase access token, or null if it can't be read */
export function tokenAssuranceLevel(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split(".")[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")))
    return typeof json.aal === "string" ? json.aal : null
  } catch {
    return null
  }
}

/** True when the session has passed the authenticator code step */
export function hasAdminMfa(accessToken: string | null | undefined) {
  return tokenAssuranceLevel(accessToken) === "aal2"
}
