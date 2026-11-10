/**
 * Meta (Facebook/Instagram) ad tracking, shared by browser and server.
 *
 * Off unless NEXT_PUBLIC_META_PIXEL_ID is set. A visitor who opts out on /privacy/choices, or whose
 * browser sends Global Privacy Control, is never tracked: the opt-out is a cookie so the server
 * (checkout, signup) can see it too.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || ""
export const ADS_OPT_OUT_COOKIE = "pt_ads_optout"

export type MetaEventName = "PageView" | "ViewContent" | "CompleteRegistration" | "InitiateCheckout" | "Purchase"
