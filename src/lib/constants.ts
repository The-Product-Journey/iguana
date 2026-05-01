/** Sponsorship tiers — amount in cents */
export const SPONSOR_TIER_THRESHOLD_CENTS = 50000; // $500

// Internal DB enum values "top" / "community" — UI labels: "Trojan Sponsor" / "Community Service Project Sponsor"
export function getSponsorTier(amountCents: number): "top" | "community" {
  return amountCents >= SPONSOR_TIER_THRESHOLD_CENTS ? "top" : "community";
}

export function getSponsorTierLabel(tier: "top" | "community"): string {
  return tier === "top" ? "Trojan" : "Community Service";
}

export const REFUND_POLICY_TEXT =
  "All payments are final. No refunds will be issued.";

/**
 * Platform application fee skimmed from every Stripe Connect destination
 * charge. The connected account (reunion organizer) absorbs Stripe processing
 * fees (~2.9% + $0.30) plus this application fee — so the connected account
 * receives `(charge - computePlatformFeeCents(charge) - stripe processing fee)`.
 *
 * Two components, both billable on every charge:
 *  - Fixed:      flat cents added regardless of charge amount
 *  - Percentage: percent of the charge (whole-percent integer; 1 = 1%)
 *
 * Set either to 0 to disable that component. In production you'll likely
 * pick one or the other; both are wired so we can experiment.
 */
export const PLATFORM_FIXED_FEE_CENTS = 100; // $1.00
export const PLATFORM_PERCENT_FEE = 1; // 1%

/**
 * Total platform application fee for a given charge amount, in cents.
 * `application_fee_amount` parameter on the Stripe Checkout Session.
 */
export function computePlatformFeeCents(chargeAmountCents: number): number {
  const percent = Math.round((chargeAmountCents * PLATFORM_PERCENT_FEE) / 100);
  return PLATFORM_FIXED_FEE_CENTS + percent;
}
