import { getPackStatus } from "@/lib/stripe/pack-offer"
import { formatUsd, getConfiguredPlanIds, packLabel, subscriptionPlans } from "@/lib/pricing-config"

/**
 * Server component: what customers can buy right now, and why anything is hidden.
 * Answers "is the pack live?" without guessing at Vercel env vars.
 */
export async function OnSaleCard() {
  const configured = getConfiguredPlanIds()
  const pack = await getPackStatus().catch((error) => ({
    onSale: false as const,
    reason: error instanceof Error ? error.message : "Couldn't check the pack",
  }))

  return (
    <section className="rounded-lg border bg-white p-5 dark:bg-gray-900">
      <h2 className="text-lg font-semibold">On sale now</h2>
      <p className="mb-3 text-sm text-gray-500">What the pricing page, home page and out-of-tales prompts offer.</p>
      <ul className="space-y-2 text-sm">
        {subscriptionPlans.map((plan) => (
          <li key={plan.id} className="flex items-start justify-between gap-3">
            <span>
              {plan.name}: {plan.talesPerMonth} tales for ${plan.monthlyPrice.toFixed(2)} a month
            </span>
            {configured.includes(plan.id) ? (
              <span className="shrink-0 font-medium text-teal-700">On sale</span>
            ) : (
              <span className="shrink-0 font-medium text-amber-700">Coming soon (no Stripe price)</span>
            )}
          </li>
        ))}
        <li className="flex items-start justify-between gap-3">
          {pack.onSale ? (
            <>
              <span>
                Try pack: {packLabel(pack.offer)}, one time
                <span className="block text-xs text-gray-500">
                  Price {pack.priceId} ({pack.priceSource}) · {formatUsd(pack.offer.priceCents)}
                </span>
              </span>
              <span className="shrink-0 font-medium text-teal-700">On sale</span>
            </>
          ) : (
            <>
              <span>
                Try pack
                <span className="block text-xs text-gray-500">{pack.reason}</span>
              </span>
              <span className="shrink-0 font-medium text-amber-700">Hidden</span>
            </>
          )}
        </li>
      </ul>
    </section>
  )
}
