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
- Charge amount transfers to the connected account, **minus** the platform
  application fee (`PLATFORM_APPLICATION_FEE_CENTS` in `src/lib/constants.ts`,
  currently $2)
- Because `on_behalf_of: connectedAccountId` is set, Stripe processing fees
  (~2.9% + $0.30) are debited from the **connected account's** balance, not
  the platform's
- Net result on a $25 sponsor donation:
  - Customer pays: $25.00
  - Platform receives: $2.00 (application fee)
  - Stripe processing fees: ~$1.03 (debited from connected account)
  - Connected account net: ~$21.97
- To remove the platform fee entirely, set `PLATFORM_APPLICATION_FEE_CENTS = 0`
  in `src/lib/constants.ts`. To raise it, change the same constant.

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
