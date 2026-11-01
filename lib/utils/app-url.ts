/**
 * Returns the app's public base URL from NEXT_PUBLIC_APP_URL with surrounding
 * whitespace and trailing slashes removed, so `${base}/path` never produces "//path".
 */
export function getAppBaseUrl(fallback = ""): string {
  return (process.env.NEXT_PUBLIC_APP_URL || fallback).trim().replace(/\/+$/, "")
}
