import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * Watermark by what paid for THIS tale. Only a tale made with the free signup tale is watermarked;
 * plan, pack and admin-gifted tales are not, nor are admins'.
 *
 * It used to check whether the account still had pack/gift tales left after this one was spent,
 * so the tale that used up the last gifted tale came out watermarked and earlier ones did not.
 * The upload logs a "deduction" (metadata.deducted_from = "purchased" for pack and gifted tales)
 * just before n8n creates the entry, so the latest deduction at or before created_at is this tale's.
 */
export async function shouldWatermark(userId: string | null | undefined, entryCreatedAt?: string | null): Promise<boolean> {
  if (!userId) return true
  const { data } = await supabaseAdmin
    .from("users")
    .select("subscription_status, is_admin")
    .eq("id", userId)
    .maybeSingle()
  if (!data) return true
  if (data.is_admin) return false
  if (["active", "trialing", "past_due"].includes(data.subscription_status ?? "")) return false

  let query = supabaseAdmin
    .from("credit_transactions")
    .select("metadata, created_at")
    .eq("user_id", userId)
    .eq("transaction_type", "deduction")
    .order("created_at", { ascending: false })
    .limit(1)
  if (entryCreatedAt) query = query.lte("created_at", entryCreatedAt)
  const { data: deduction } = await query.maybeSingle()
  const paidWith = (deduction?.metadata as any)?.deducted_from
  console.log("🏷️ Tale paid with:", paidWith ?? "unknown")
  return paidWith !== "purchased"
}
