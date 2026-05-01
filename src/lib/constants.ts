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
