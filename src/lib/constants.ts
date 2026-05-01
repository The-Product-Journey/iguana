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
 * Hard cap on the platform application fee, as a percent of the charge.
 * **Permanent safety floor.** Whatever the fixed + percent components
 * compute to, the platform fee will never exceed this percentage of the
 * charge. Prevents misconfigurations (e.g. someone bumps PLATFORM_PERCENT_FEE
 * to 50 by accident, or the fixed fee being a huge fraction of a small
 * charge) from sending negative net to the connected account.
 *
 * On the smallest plausible charge ($10 sponsor minimum) with this cap at
 * 10%, the platform takes at most $1 and Stripe takes ~$0.59 — connected
 * account always gets ≥ $8.41. Never goes negative.
 */
export const PLATFORM_MAX_FEE_PERCENT = 10;

/**
 * Net platform fee — what we want to keep after Stripe takes its cut.
 * This is NOT what we pass to Stripe as `application_fee_amount`. See
 * `computeApplicationFeeCents()` below for the gross amount.
 */
export function computePlatformFeeCents(chargeAmountCents: number): number {
  const percent = Math.round((chargeAmountCents * PLATFORM_PERCENT_FEE) / 100);
  const computed = PLATFORM_FIXED_FEE_CENTS + percent;
  const cap = Math.floor(
    (chargeAmountCents * PLATFORM_MAX_FEE_PERCENT) / 100
  );
  if (computed > cap) {
    console.warn(
      `[platform-fee] Computed fee ${computed}¢ exceeded ${PLATFORM_MAX_FEE_PERCENT}% cap ${cap}¢ on charge ${chargeAmountCents}¢ — capping.`
    );
    return cap;
  }
  return computed;
}

/**
 * Estimated Stripe processing fee for a US-based card charge: 2.9% + $0.30.
 *
 * In our destination-charge setup with `on_behalf_of` set, Stripe fees are
 * still debited from the **platform** balance by default for Express accounts
 * (the on_behalf_of parameter affects merchant-of-record presentment, not
 * fee payer). To make the connected account effectively bear the fee, we
 * add this estimate to `application_fee_amount` so the platform recoups
 * what it's about to pay Stripe.
 *
 * Estimate is approximate — international cards, 3D Secure surcharges,
 * dispute handling can push the actual fee higher; ACH (not used here)
 * would be lower. Variance is absorbed by the platform.
 */
const STRIPE_FEE_FIXED_CENTS = 30;
const STRIPE_FEE_BPS = 290; // 2.9%

export function computeStripeFeeEstimateCents(
  chargeAmountCents: number
): number {
  return (
    STRIPE_FEE_FIXED_CENTS +
    Math.round((chargeAmountCents * STRIPE_FEE_BPS) / 10000)
  );
}

/**
 * Gross application fee passed to Stripe as `application_fee_amount`.
 * Platform's intended take + estimated Stripe fee that the platform is
 * about to absorb. After Stripe debits the actual processing fee from
 * the platform balance, the platform's net keep is approximately
 * `computePlatformFeeCents(charge)`.
 */
export function computeApplicationFeeCents(chargeAmountCents: number): number {
  return (
    computePlatformFeeCents(chargeAmountCents) +
    computeStripeFeeEstimateCents(chargeAmountCents)
  );
}
