import { cache } from "react"
import type { PackOffer } from "@/lib/pricing-config"
import { getAllPacks, getPackPriceId, packsEnabled, type CreditPack } from "@/lib/stripe/pack-config"

/**
 * Server-only: the one-time pack that is on sale, worked out the same way for every page (home,
 * pricing, pets, settings, the out-of-tales modal) and for checkout, so they can never disagree.
 *
 * A pack is on sale when SHOW_CREDIT_PACKS=true, its credit_packs row is active, and it has a
 * Stripe price. The price comes from, in order:
 *   1. STRIPE_PACK_<ID>_PRICE_ID (e.g. STRIPE_PACK_TRY_PACK_PRICE_ID) or STRIPE_<ID>_PRICE_ID
 *      (a prod_ product ID there is turned into that product's price)
 *   2. credit_packs.stripe_price_id when it is a real price_ id
 *   3. an active one-time USD price in Stripe with the pack's amount (found once, then cached)
 * Step 3 means a typo in the env var name doesn't silently hide the pack.
 */

export type PackStatus =
  | { onSale: true; offer: PackOffer; priceId: string; priceSource: string }
  | { onSale: false; reason: string }

const CACHE_MS = 10 * 60 * 1000
let stripeLookup: { at: number; byAmount: Map<number, string> } | null = null

async function findStripePriceByAmount(cents: number): Promise<string | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!stripeLookup || Date.now() - stripeLookup.at > CACHE_MS) {
    try {
      const { stripe } = await import("@/lib/stripe")
      const prices = await stripe.prices.list({ active: true, type: "one_time", currency: "usd", limit: 100 })
      const byAmount = new Map<number, string>()
      for (const p of prices.data) {
        if (p.unit_amount != null && !byAmount.has(p.unit_amount)) byAmount.set(p.unit_amount, p.id)
      }
      stripeLookup = { at: Date.now(), byAmount }
    } catch (error) {
      console.error("[pack-offer] Stripe price lookup failed:", error)
      return null
    }
  }
  return stripeLookup.byAmount.get(cents) ?? null
}

const productLookup = new Map<string, { at: number; priceId: string | null }>()

/**
 * A product ID was pasted where a price ID belongs (an easy mix-up in the Stripe dashboard).
 * Use that product's one-time price with the pack's amount, else its default price.
 */
async function priceForProduct(productId: string, cents: number): Promise<string | null> {
  const hit = productLookup.get(productId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.priceId
  if (!process.env.STRIPE_SECRET_KEY) return null
  try {
    const { stripe } = await import("@/lib/stripe")
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 })
    const oneTime = prices.data.filter((p) => p.type === "one_time")
    const product = await stripe.products.retrieve(productId)
    const defaultId = typeof product.default_price === "string" ? product.default_price : product.default_price?.id
    const priceId =
      oneTime.find((p) => p.unit_amount === cents)?.id ??
      oneTime.find((p) => p.id === defaultId)?.id ??
      oneTime[0]?.id ??
      null
    productLookup.set(productId, { at: Date.now(), priceId })
    return priceId
  } catch (error) {
    console.error(`[pack-offer] Could not find a price for product ${productId}:`, error)
    return null
  }
}

/** The Stripe price to charge for a pack, and where it came from */
export async function resolvePackPrice(
  pack: Pick<CreditPack, "id" | "stripe_price_id" | "price_cents">,
): Promise<{ priceId: string; source: string } | null> {
  const direct = getPackPriceId(pack)
  if (direct?.startsWith("price_")) return { priceId: direct, source: "Vercel env var or credit_packs.stripe_price_id" }
  if (direct?.startsWith("prod_")) {
    const fromProduct = await priceForProduct(direct, pack.price_cents)
    if (fromProduct) return { priceId: fromProduct, source: `price of Stripe product ${direct} (a product ID was set, not a price ID)` }
  }
  const found = await findStripePriceByAmount(pack.price_cents)
  if (found) return { priceId: found, source: `Stripe one-time price for ${pack.price_cents} cents` }
  return null
}

export async function getPackStatus(): Promise<PackStatus> {
  if (!packsEnabled()) return { onSale: false, reason: "SHOW_CREDIT_PACKS is not true in Vercel" }
  const packs = await getAllPacks()
  if (packs.length === 0) return { onSale: false, reason: "No active row in credit_packs (run the try_pack migration)" }

  // The smallest active pack is the one we sell
  const pack = [...packs].sort((a, b) => a.credits - b.credits)[0]
  const price = await resolvePackPrice(pack)
  if (!price) {
    return {
      onSale: false,
      reason: `No Stripe price for "${pack.id}": set STRIPE_PACK_${pack.id.toUpperCase()}_PRICE_ID in Vercel and redeploy`,
    }
  }
  return {
    onSale: true,
    offer: { id: pack.id, tales: pack.credits, priceCents: pack.price_cents },
    priceId: price.priceId,
    priceSource: price.source,
  }
}

/** The pack on sale, or null. Never throws, so a page always renders. Deduped per request. */
export const getPackOffer = cache(async function getPackOffer(): Promise<PackOffer | null> {
  try {
    const status = await getPackStatus()
    if (!status.onSale) {
      if (packsEnabled()) console.warn("[pack-offer] Pack hidden:", status.reason)
      return null
    }
    return status.offer
  } catch (error) {
    console.error("[pack-offer] getPackOffer failed:", error)
    return null
  }
})
