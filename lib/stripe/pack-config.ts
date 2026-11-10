import { createClient } from "@/lib/supabase/server"

/**
 * Credit pack definition matching the credit_packs database table
 */
export interface CreditPack {
  id: string
  name: string
  description: string
  credits: number
  price_cents: number
  stripe_price_id: string
  display_order: number
  popular: boolean
  active: boolean
}

/** The one-time pack offered at launch: 3 tales for $2.99 (row in credit_packs, id "try_pack") */
export const TRY_PACK = { id: "try_pack", tales: 3, price: 2.99 } as const

/**
 * Server-only: the Stripe price to charge for a pack. STRIPE_PACK_<ID>_PRICE_ID (e.g.
 * STRIPE_PACK_TRY_PACK_PRICE_ID) wins over credit_packs.stripe_price_id, so the price can live in
 * Vercel with the plan prices instead of in the table.
 */
export function getPackPriceId(pack: Pick<CreditPack, "id" | "stripe_price_id">): string | null {
  const id = pack.id.toUpperCase()
  const fromEnv = (process.env[`STRIPE_PACK_${id}_PRICE_ID`] || process.env[`STRIPE_${id}_PRICE_ID`])?.trim()
  if (fromEnv) return fromEnv
  return pack.stripe_price_id?.startsWith("price_") ? pack.stripe_price_id : null
}

/** Server-only: packs are shown and sold only when SHOW_CREDIT_PACKS=true */
export function packsEnabled(): boolean {
  return process.env.SHOW_CREDIT_PACKS === "true"
}

/**
 * Fetch all active credit packs from the database
 *
 * @returns Promise with array of active credit packs ordered by display_order
 *
 * @example
 * const packs = await getAllPacks()
 * packs.forEach(pack => {
 *   console.log(`${pack.name}: ${formatPrice(pack.price_cents)}`)
 * })
 */
export async function getAllPacks(): Promise<CreditPack[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("display_order", { ascending: true })

    if (error) {
      console.error("[v0] getAllPacks error:", error)
      return []
    }

    return (data as CreditPack[]) || []
  } catch (error) {
    console.error("[v0] getAllPacks exception:", error)
    return []
  }
}

/**
 * Fetch a single credit pack by its ID
 *
 * @param packId - The pack ID (e.g., 'quick_fix', 'party_pack', 'creator_bundle')
 * @returns Promise with credit pack or null if not found
 *
 * @example
 * const pack = await getPackById('party_pack')
 * if (pack) {
 *   console.log(`${pack.name}: ${pack.credits} credits for ${formatPrice(pack.price_cents)}`)
 * }
 */
export async function getPackById(packId: string): Promise<CreditPack | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("credit_packs").select("*").eq("id", packId).single()

    if (error) {
      console.error("[v0] getPackById error:", error)
      return null
    }

    return (data as CreditPack) || null
  } catch (error) {
    console.error("[v0] getPackById exception:", error)
    return null
  }
}

/**
 * Fetch a credit pack by its Stripe price ID
 * Useful for webhook processing where Stripe sends the price_id
 *
 * @param stripePriceId - The Stripe price ID (e.g., 'price_1SM6eFFpZROfOQcRllKbnqhk')
 * @returns Promise with credit pack or null if not found
 *
 * @example
 * // In Stripe webhook handler
 * const pack = await getPackByStripePriceId(session.line_items[0].price.id)
 * if (pack) {
 *   await addPurchasedCredits(userId, pack.credits, pack.id, paymentIntentId)
 * }
 */
export async function getPackByStripePriceId(stripePriceId: string): Promise<CreditPack | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("stripe_price_id", stripePriceId)
      .single()

    if (error) {
      console.error("[v0] getPackByStripePriceId error:", error)
      return null
    }

    return (data as CreditPack) || null
  } catch (error) {
    console.error("[v0] getPackByStripePriceId exception:", error)
    return null
  }
}

/**
 * Format price in cents to dollar string
 *
 * @param priceCents - Price in cents (e.g., 399 for $3.99)
 * @returns Formatted price string (e.g., "$3.99")
 *
 * @example
 * formatPrice(399)  // "$3.99"
 * formatPrice(1000) // "$10.00"
 * formatPrice(0)    // "$0.00"
 */
export function formatPrice(priceCents: number): string {
  // Handle edge cases
  if (priceCents < 0) {
    return "$0.00"
  }

  const dollars = priceCents / 100
  return `$${dollars.toFixed(2)}`
}
