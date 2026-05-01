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
 * receives `(charge - PLATFORM_APPLICATION_FEE_CENTS - stripe processing fee)`.
 *
 * Set to $2 during MVP. Change to 0 once we want to drop platform-fee charging
 * entirely, or scale up if we move to a larger SaaS pricing model.
 */
export const PLATFORM_APPLICATION_FEE_CENTS = 200;
