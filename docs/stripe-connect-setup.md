# Stripe Connect Setup

This app uses Stripe Connect Express accounts with destination charges. Payments from attendees and sponsors are automatically routed to the reunion organizer's connected Stripe account.

## 1. Enable Stripe Connect

1. Go to [Stripe Dashboard → Connect → Settings](https://dashboard.stripe.com/settings/connect)
2. Enable Express accounts
3. Configure your platform profile (name, icon, brand color) — this is shown during organizer onboarding

## 2. Environment Variables

No new env vars needed for Connect. The existing ones cover everything:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 3. Webhook Configuration

Register **one** webhook endpoint in [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks):

- URL: `https://your-domain.com/api/webhooks/stripe`
- Check **"Events on Connected accounts"** to also receive Connect events
- Events: `checkout.session.completed`, `checkout.session.expired`, `account.updated`

One endpoint, one signing secret (`STRIPE_WEBHOOK_SECRET`), handles both platform and Connect events.

## 4. Organizer Onboarding Flow

1. Admin navigates to `/admin/{slug}` and clicks "Set up payouts"
2. This creates a Stripe Express account (organizer chooses individual or business during Stripe's onboarding)
3. Organizer is redirected to Stripe's hosted onboarding form
4. They provide identity info and connect a bank account (personal or business)
5. On return, the admin panel runs a one-shot status refresh and shows the account status

**Manual-refresh model:** The admin page does NOT poll Stripe for status changes on an interval. After completing Stripe onboarding, the post-return URL (`?connect=complete`) triggers a single `refreshStatus()` call. If Stripe takes longer to flip `charges_enabled` / `payouts_enabled` than that one check, the admin must hard-refresh `/admin/{slug}` to see the updated status. The `account.updated` webhook keeps the DB in sync in the background regardless. Adding interval polling is intentionally deferred — file a follow-up if needed.

### Status States

| State | Meaning |
|-------|---------|
| Not connected | No Stripe account created yet |
| Onboarding incomplete | Started but didn't finish the Stripe form |
| Verification pending | Form submitted, Stripe reviewing identity |
| Bank verification pending | Charges work, bank payout verification in progress |
| Payouts active | Fully active — payments received and paid out |

## 5. How Payments Work

- Attendee/sponsor pays → Stripe Checkout Session with `transfer_data.destination`,
  `on_behalf_of`, and `application_fee_amount` set
- The `application_fee_amount` is **gross** — it includes both the platform's
  intended cut AND a compensating estimate of the Stripe processing fee
  (because for default Express accounts Stripe debits processing fees from
  the platform balance, not the connected account)
- Connected account receives: `charge - application_fee_amount`
- Platform receives: `application_fee_amount`, then Stripe debits the actual
  processing fee from the platform balance, leaving a net keep approximately
  equal to `computePlatformFeeCents()`

### Fee structure

```ts
// What the platform wants to NET keep
PLATFORM_FIXED_FEE_CENTS = 100      // $1.00 flat
PLATFORM_PERCENT_FEE = 1            // 1% of charge
PLATFORM_MAX_FEE_PERCENT = 10       // permanent cap on net platform fee

// Stripe's fee — added to the gross application_fee_amount as compensation
STRIPE_FEE_FIXED_CENTS = 30         // $0.30
STRIPE_FEE_BPS = 290                // 2.9%

// Final application_fee_amount passed to Stripe Checkout
//   = platform's net + estimated Stripe fee
//   = computePlatformFeeCents(charge) + computeStripeFeeEstimateCents(charge)
```

Set `PLATFORM_FIXED_FEE_CENTS` or `PLATFORM_PERCENT_FEE` to 0 to disable
that component. The Stripe fee compensation is independent and always
applied.

`PLATFORM_MAX_FEE_PERCENT` is a permanent safety floor on the **platform
portion** (not the total application fee). Prevents misconfigurations of
the platform fee components from eating the transfer.

### Example: $25 sponsor donation (with $1 fixed + 1% percent)

```
Customer pays:                   $25.00
application_fee_amount:           $2.28
  - Platform's net cut:           $1.25  ($1 fixed + $0.25 percent)
  - Stripe fee compensation:      $1.03  ($0.30 + 2.9% of $25)
Platform balance flow:
  + $2.28 (received from app fee)
  - $1.03 (actual Stripe fee debit)
  = $1.25 net platform keep
Connected account net:           $22.72  ($25 - $2.28)
```

### Caveats

- The Stripe fee estimate (2.9% + $0.30) is for US-based card payments.
  International cards, 3D Secure surcharges, or disputes can push the
  actual fee higher; in those cases the platform absorbs the variance.
- ACH and other low-fee rails would have us over-collecting; we don't
  support them, but if you ever do, recompute or itemize the estimate.

## 6. Charges vs Payouts Timing

When `chargesEnabled=true` but `payoutsEnabled=false`:
- The system accepts payments (destination charges work)
- Funds accumulate in the connected account's Stripe balance
- The organizer cannot withdraw to their bank until `payoutsEnabled` becomes true
- This is typically a brief window during bank account verification
- Admins see "Bank verification pending" status

## 7. Testing in Development

1. Use Stripe test mode keys
2. Create a test Express account via the admin panel
3. Stripe provides a simulated onboarding flow in test mode
4. Use [Stripe test cards](https://docs.stripe.com/testing#cards) for payments
5. Optionally uncomment the seed data fields in `src/lib/db/seed.ts` to skip onboarding
