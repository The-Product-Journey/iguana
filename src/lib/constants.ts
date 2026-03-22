/** Sponsorship tiers — amount in cents */
export const SPONSOR_TIER_THRESHOLD_CENTS = 50000; // $500

export function getSponsorTier(amountCents: number): "top" | "community" {
  return amountCents >= SPONSOR_TIER_THRESHOLD_CENTS ? "top" : "community";
}
