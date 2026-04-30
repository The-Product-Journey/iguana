# PLAN: Stripe Connect with Destination Charges

## Context Gathered

### Current State
- Next.js 16 app (App Router) with Stripe SDK v20, Drizzle ORM, Turso (SQLite)
- Two payment flows: registration checkout (`/api/checkout`) and sponsor checkout (`/api/sponsor-checkout`)
- Stripe webhook handler at `/api/webhooks/stripe`
- All payments currently go directly to the platform's Stripe account
- "Cover processing fees" UX already exists on the registration form (preset % or custom amount)
- Admin panel at `/admin/[slug]` shows revenue stats

### Problem
Payments land in the platform's Stripe account. The reunion organizer (PH Class of '96) needs to receive the money directly. They may be an individual with a personal bank account, not a business.

### Solution: Stripe Connect Express + Destination Charges
- **Express accounts**: Stripe-hosted onboarding, supports individuals and businesses (organizer chooses during Stripe onboarding), personal or business bank accounts, minimal friction
- **Destination charges**: Payment created on platform account, funds auto-transfer to connected account. Platform can optionally take `application_fee_amount` (0% for now, can add later)
- **Fee handling**: With destination charges and no `application_fee_amount`, 100% of the charge transfers to the connected account. Stripe processing fees are debited from the platform's balance. The existing "cover processing fees" attendee opt-in offsets this cost.

---

## Objective
Replace direct Stripe charges with Stripe Connect destination charges so that payments flow through to the reunion organizer's bank account via an Express connected account.

## Scope
- Add Stripe Connect Express account creation + onboarding flow for organizers
- Store connected account ID per reunion
- Modify both checkout routes to use destination charges
- Update webhook handler for Connect events
- Add connected account status to admin panel
- Handle edge case: no connected account yet (block payments or warn)

## Out of Scope
- Platform fees / application_fee_amount (future work)
- Organizer dashboard beyond the Stripe Express Dashboard
- Refund handling (no changes needed — Stripe handles refund routing for destination charges)
- Changing the "cover processing fees" UX (it works as-is)

---

## Micro-Tasks

### 1. Add `stripeConnectedAccountId` column to `reunions` table
- Add `stripeConnectedAccountId` (nullable text) to the `reunions` schema in `src/lib/db/schema.ts`
- Add `stripeConnectOnboardingComplete` (nullable boolean, default false) to track whether onboarding is finished
- Add `stripeConnectChargesEnabled` (nullable boolean, default false) to track whether the connected account can accept charges (distinct from onboarding complete — Stripe may require additional verification after onboarding)
- Add `stripeConnectPayoutsEnabled` (nullable boolean, default false) to track whether the connected account can pay out to the organizer's bank account (Stripe may enable charges before payouts if bank verification is pending)
- Note on nullable booleans: `null` and `false` are equivalent for all plan logic. The default `false` means these columns never need a null-check distinct from a false-check — once the account exists, the booleans are always explicitly set. `stripeConnectedAccountId IS NULL` is the sole indicator of "no connected account".
- Run `db:push` to apply the migration
- **Success criteria**: All four columns exist in schema, `db:push` succeeds without error
- **Files**: `src/lib/db/schema.ts`
- **Depends on**: Nothing

### 2. Create API route: POST `/api/admin/connect/create`
- **Guard**: If `stripeConnectedAccountId` already exists for this reunion, return error "Account already created — use resume onboarding." Do NOT create a second connected account.
- Creates a Stripe Express account (`type: 'express'`, `country: 'US'`, capabilities: `card_payments` + `transfers`). **Do NOT pass `business_type`** — omitting it lets Stripe's hosted onboarding ask the organizer whether they are an individual or a business. This handles both personal and business bank accounts without us guessing.
- Saves `account.id` to `reunions.stripeConnectedAccountId`
- Generates an Account Link (onboarding URL) with `type: 'account_onboarding'`
- Returns the onboarding URL to redirect the organizer
- `refresh_url` → `${NEXT_PUBLIC_BASE_URL}/admin/{slug}?connect=refresh` (link expired, re-generate). **Must be an absolute URL** — Stripe rejects relative URLs. Use the same `NEXT_PUBLIC_BASE_URL` pattern as the existing checkout routes.
- `return_url` → `${NEXT_PUBLIC_BASE_URL}/admin/{slug}?connect=complete` (onboarding finished — but must still verify). **Must be an absolute URL.**
- Requires admin auth (same pattern as other admin routes)
- **Success criteria**: API returns a valid Stripe onboarding URL; connected account ID is saved to DB
- **Files**: `src/app/api/admin/connect/create/route.ts`
- **Depends on**: Task 1

### 3. Create API route: GET `/api/admin/connect/status`
- Requires admin auth (same pattern as other admin routes — check `admin_auth` cookie)
- Takes `reunionId` query param
- Retrieves `stripeConnectedAccountId` from DB
- Calls `stripe.accounts.retrieve(connectedAccountId)`
- Returns `{ detailsSubmitted, chargesEnabled, payoutsEnabled }` (or null if no connected account)
- **Write-through**: If `chargesEnabled`, `payoutsEnabled`, or `detailsSubmitted` has changed from what's in the DB, update `stripeConnectOnboardingComplete`, `stripeConnectChargesEnabled`, and `stripeConnectPayoutsEnabled` in the reunions table. This ensures the DB stays in sync even if webhooks are delayed.
- **Success criteria**: Returns correct onboarding status from Stripe API; DB is updated if status changed
- **Files**: `src/app/api/admin/connect/status/route.ts`
- **Depends on**: Task 1

### 4. Create API route: POST `/api/admin/connect/onboarding-link`
- Requires admin auth (same pattern as other admin routes — check `admin_auth` cookie)
- For re-generating an onboarding link if the organizer needs to resume/retry
- Same Account Link creation logic as task 2, but doesn't create a new account — uses existing `stripeConnectedAccountId`
- Uses absolute URLs for `refresh_url` and `return_url` (same as Task 2)
- **Success criteria**: Returns a fresh onboarding URL for an existing connected account
- **Files**: `src/app/api/admin/connect/onboarding-link/route.ts`
- **Depends on**: Task 1

### 5. Add Connect onboarding UI to admin panel
- Add a "Stripe Connect" section to the admin page for the reunion
- States:
  - **No connected account**: Show "Set up payouts" button → calls `/api/admin/connect/create` and redirects organizer to Stripe
  - **Account created but onboarding incomplete**: Show "Resume onboarding" button → calls `/api/admin/connect/onboarding-link` and redirects
  - **Charges enabled, payouts pending**: Show yellow "Bank verification pending" status — charges are accepted but funds are held until bank account is verified. Show a "Payouts pending" badge distinct from "Verification pending".
  - **Both charges and payouts enabled**: Show green "Payouts active" status badge — full end-to-end flow confirmed
  - **Onboarding complete, charges NOT enabled**: Show yellow "Verification pending" status — Stripe may require additional identity/business verification after onboarding form is submitted. Note: Stripe can produce `charges_enabled=false, payouts_enabled=true` as a restricted capability state. This is collapsed into the same "Verification pending" display — it does not require a separate UI state, but the component should not assume that `payouts_enabled=true` implies `charges_enabled=true`.
- Handle `?connect=complete` URL param: call `/api/admin/connect/status` on load, which write-through updates `stripeConnectOnboardingComplete`, `stripeConnectChargesEnabled`, and `stripeConnectPayoutsEnabled` in the DB. Display the result. This ensures the RSVP payment guard (Task 9) unlocks immediately without waiting for webhook delivery.
- Handle `?connect=refresh`: call `/api/admin/connect/onboarding-link` and redirect to the returned URL
- **Success criteria**: Admin can initiate onboarding, see status, and resume if needed
- **Files**: `src/app/admin/[slug]/page.tsx`, `src/components/connect-status.tsx` (new client component)
- **Depends on**: Tasks 2, 3, 4

### 6. Modify `/api/checkout` to use destination charges
- **Important**: Validate connected account status BEFORE any DB writes. The current route inserts an RSVP record and registration_events before creating the Stripe session. Move the connected-account check (look up `stripeConnectedAccountId` and verify `stripeConnectChargesEnabled`) to the top of the handler, immediately after input validation and reunion lookup. Return 400 "Payouts not configured — organizer needs to complete Stripe setup" before creating the RSVP record. This prevents orphan pending RSVPs when Connect is misconfigured.
- Add `payment_intent_data.transfer_data.destination` and `payment_intent_data.on_behalf_of` to the Checkout Session create call, both set to the connected account ID. Both must be nested under `payment_intent_data` for Checkout Sessions.
- No `application_fee_amount` for now (0% platform fee)
- Keep all existing metadata, line items, success/cancel URLs unchanged
- Note: This route is only reached for paid registrations. Free/interest-only registrations and "pay at door" selections POST to `/api/register` instead (see `registration-form.tsx`). The Connect guard here does NOT block free registrations.
- **Success criteria**: Checkout Session includes `transfer_data.destination`; payment routes to connected account; no orphan RSVP records on validation failure
- **Files**: `src/app/api/checkout/route.ts`
- **Depends on**: Task 1

### 7. Modify `/api/sponsor-checkout` to use destination charges
- **Important**: Validate connected account status BEFORE any DB writes or file uploads. The current route creates a sponsor record and uploads a logo before calling Stripe. Move the connected-account check (look up `stripeConnectedAccountId` and verify `stripeConnectChargesEnabled`) to the top of the handler, before the sponsor insert and logo upload. Return 400 immediately if not configured. This prevents orphan sponsor records and uploaded logos when Connect is misconfigured.
- Add `payment_intent_data.transfer_data.destination` and `payment_intent_data.on_behalf_of` to the Checkout Session create call. Both must be nested under `payment_intent_data` (same as Task 6) — placing them at the top level of the session create params will silently fail.
- **Success criteria**: Sponsor payments route to connected account; no orphan records created on validation failure
- **Files**: `src/app/api/sponsor-checkout/route.ts`
- **Depends on**: Task 1

### 8. Update webhook handler for Connect
- Add `account.updated` event handling. **Treat the webhook as a hint only** — Stripe does not guarantee event ordering, so a stale `account.updated` could arrive after a newer one and overwrite the DB with regressed values. The correct pattern: upon receiving `account.updated`, call `stripe.accounts.retrieve(event.account)` to get the live Account object, then write the current `details_submitted`, `charges_enabled`, and `payouts_enabled` values from the retrieved account (not from the event payload). This is idempotent and immune to ordering issues.
- **Failure handling**: If `stripe.accounts.retrieve` fails (rate limit, timeout, transient error), the handler must return a 5xx response so Stripe retries the webhook. Do NOT write fallback/default values and return 200 — that would acknowledge the webhook as processed and leave the DB stale indefinitely without retry.
- Update ALL THREE fields in the DB: `stripeConnectOnboardingComplete` (from `details_submitted`), `stripeConnectChargesEnabled` (from `charges_enabled`), and `stripeConnectPayoutsEnabled` (from `payouts_enabled`). Look up the reunion by `stripeConnectedAccountId` matching the event's `account` field.
- Note: `checkout.session.completed` for destination charges fires on the platform account (existing webhook), so no change needed for payment fulfillment
- The webhook endpoint needs to also be registered as a Connect webhook in Stripe Dashboard (manual step — document it)
- **Success criteria**: `account.updated` events trigger a live Account re-read and update all three DB fields idempotently; if retrieve fails, returns 5xx so Stripe retries
- **Files**: `src/app/api/webhooks/stripe/route.ts`
- **Depends on**: Task 1

### 9. Guard payment forms when charges aren't enabled
- **Registration form (RSVP page)**: Check if the reunion has `stripeConnectChargesEnabled === true` and `stripeConnectedAccountId` is set. Use `chargesEnabled` (NOT `onboardingComplete`) as the gate — this matches the checkout route guard in Task 6 and ensures the UI and API agree on when payment is allowed. If not: hide/disable the "Pay now" radio option. The existing "Pay at the door" option remains available. Show a note like "Online payment will be available soon." Interest-only events are unaffected.
- **Sponsor form (sponsor page)**: Also check `stripeConnectChargesEnabled` on the sponsor page. If not enabled: either hide the sponsor form entirely with a "Sponsorships coming soon" message, or show the form but disable submission with a note explaining online payment is not yet available. This prevents sponsors from filling out a form and uploading a logo only to hit a 400 error from the API.
- **Success criteria**: Neither attendees nor sponsors can pay online unless the connected account has `chargesEnabled`; free registrations still work; UI gates match API gates
- **Files**: `src/app/[slug]/rsvp/page.tsx`, `src/components/registration-form.tsx`, `src/app/[slug]/sponsor/page.tsx`
- **Depends on**: Task 1

### 10. Update seed data for development
- Update seed scripts to optionally include a test connected account ID (using Stripe test mode)
- Document the test mode setup: in test mode, you can create Express accounts and simulate onboarding
- **Success criteria**: Developers can test the full flow in Stripe test mode
- **Files**: `src/lib/db/seed.ts` or `src/lib/db/seed-events.ts`
- **Depends on**: Task 1

### 11. Document Stripe Dashboard configuration
- Add a section to CLAUDE.md or a `docs/stripe-connect-setup.md` noting:
  - Stripe Dashboard -> Connect Settings: enable Express accounts
  - Webhook endpoints: register the existing webhook URL **twice** in Dashboard — once as a platform (account) webhook and once as a Connect webhook. Each registration produces a different signing secret.
  - Environment variables: document `STRIPE_CONNECT_WEBHOOK_SECRET` (new) alongside the existing `STRIPE_WEBHOOK_SECRET`. Both are required for the dual-secret webhook handler.
  - Platform profile: set branding for the Connect onboarding flow
  - Test mode: how to test the full flow (creating test Express accounts, simulating onboarding)
  - **Operational note**: When `stripeConnectChargesEnabled=true` but `stripeConnectPayoutsEnabled=false`, the system accepts charges and transfers funds to the connected account's Stripe balance, but the organizer cannot receive payouts to their bank yet. This is the expected intermediate state during Stripe's bank verification. Funds accumulate safely in Stripe until `payoutsEnabled` becomes true. Admins will see the yellow "Bank verification pending" status during this window.
- **Success criteria**: Another developer can configure a new Stripe account for this app, including both webhook registrations and both env vars
- **Files**: `docs/stripe-connect-setup.md`
- **Depends on**: All tasks complete

## Dependencies
```
Task 1 → Tasks 2, 3, 4, 6, 7, 8, 9, 10
Tasks 2, 3, 4 → Task 5
Tasks 6, 7 (independent of each other)
Task 8 (independent after Task 1)
Task 9 (independent after Task 1, but logically after 6)
Task 11 → all tasks
```

## Files Affected
- `src/lib/db/schema.ts` — add 4 columns to `reunions`: `stripeConnectedAccountId`, `stripeConnectOnboardingComplete`, `stripeConnectChargesEnabled`, `stripeConnectPayoutsEnabled`
- `src/app/api/admin/connect/create/route.ts` — NEW
- `src/app/api/admin/connect/status/route.ts` — NEW
- `src/app/api/admin/connect/onboarding-link/route.ts` — NEW
- `src/app/admin/[slug]/page.tsx` — add Connect status section
- `src/components/connect-status.tsx` — NEW client component
- `src/app/api/checkout/route.ts` — add destination charges
- `src/app/api/sponsor-checkout/route.ts` — add destination charges
- `src/app/api/webhooks/stripe/route.ts` — handle `account.updated`
- `src/app/[slug]/rsvp/page.tsx` — guard paid checkout
- `src/components/registration-form.tsx` — disable paid path when no connected account
- `src/lib/db/seed.ts` — optional test connected account
- `docs/stripe-connect-setup.md` — NEW setup guide

## Risk Areas
1. **Stripe Connect must be enabled on the platform's Stripe account** — this is a Dashboard setting, not code. If not enabled, account creation will fail.
2. **Who pays Stripe fees with destination charges**: By default, the **platform** pays processing fees (~2.9% + $0.30). With 0% application fee, this means the platform absorbs ~$2.48 per $75 transaction. The "cover processing fees" opt-in from attendees offsets this, but if an attendee declines, the platform eats the cost. This is acceptable for now but should be monitored.
3. **Webhook signing for Connect events**: RESOLVED — using a single endpoint with dual-secret approach. Add `STRIPE_CONNECT_WEBHOOK_SECRET` env var. The handler tries the platform secret first; if signature verification fails, tries the Connect secret. Both endpoints must be registered in Stripe Dashboard (one as account webhook, one as Connect webhook, both pointing to the same URL).
4. **Onboarding completion is async**: The organizer may start onboarding but not finish. The `?connect=complete` return URL doesn't guarantee completion — must always verify via API.
5. **SQLite migration**: `db:push` on Turso should handle adding nullable columns, but verify it doesn't require a full table rebuild.

---

## Audit Findings

### Plan Audit

- [WARNING] Task 2: The route creates an Express account AND generates an onboarding link in one call. This is correct for the initial flow but the task description should clarify that if `stripeConnectedAccountId` already exists, it should NOT create a new account (use task 4 instead). → **Fix**: Add guard: if connected account already exists, return error "Account already created, use resume onboarding".

- [WARNING] Task 5: `?connect=refresh` says "auto-generate new link and redirect" — this should call the `/api/admin/connect/onboarding-link` endpoint, not silently generate a link. The client component needs to handle this redirect on mount. → **Fix**: Clarify that the client component detects the URL param and calls the API, then redirects.

- [WARNING] Task 8: Webhook signing concern — Stripe Connect webhooks can be configured in the Dashboard to go to the same endpoint, but they use a **separate webhook signing secret**. The handler needs to try both secrets or use a separate endpoint. → **Fix**: Use a single endpoint but try platform secret first, then Connect secret (stored as `STRIPE_CONNECT_WEBHOOK_SECRET` env var). Or better: use two separate webhook routes. Given simplicity, recommend adding a second env var and trying both.

- [WARNING] Task 9: The registration form is a client component. It doesn't currently receive the connected account status. The parent page (`rsvp/page.tsx`) needs to pass a `chargesEnabled` prop. → **Fix**: `rsvp/page.tsx` must query the reunion's connect status and pass `chargesEnabled` (not `payoutsEnabled`) down to `RegistrationForm`. Gate is on `chargesEnabled` — destination charges are accepted even when `payoutsEnabled=false`.

- [NIT] Task 10: Test connected account IDs from Stripe test mode are ephemeral — they won't persist across Stripe account resets. Seed data should document this. → **Fix**: Add comment in seed file.

- [NIT] Task 6 & 7: Should also pass `on_behalf_of` to make the connected account's name appear on the attendee's credit card statement, rather than the platform name. → **Fix**: Add `on_behalf_of` parameter alongside `transfer_data.destination`. Optional but improves UX.

### Residual Risk
- The platform absorbs Stripe fees when attendees don't opt into "cover fees". At scale this could be significant, but for a single reunion this is negligible.
- Stripe Connect must be manually enabled in the Dashboard — there's no API for this. If the developer forgets, the first API call will fail with a clear error.
- Stripe Express account onboarding requires the organizer to have a US bank account (personal or business) and provide identity info. For individuals: SSN last 4, DOB. For businesses: EIN, business details, beneficial owners. The organizer chooses their type during Stripe's hosted onboarding. If they're uncomfortable with identity verification or don't have a US bank account, the flow breaks. No code fix for this — it's a product constraint.

---

## Revised Plan (incorporating audit findings)

All micro-tasks above remain the same with these refinements:

**Task 1 (revised)**: Add four columns: `stripeConnectedAccountId` (text), `stripeConnectOnboardingComplete` (boolean), `stripeConnectChargesEnabled` (boolean), and `stripeConnectPayoutsEnabled` (boolean). The three booleans allow the system to distinguish "onboarding done but charges not yet enabled", "charges enabled but bank verification pending (payouts held)", and "fully active" — giving the admin panel accurate, granular status for each transition state Stripe can produce.

**Task 2 (revised)**: Guard against re-creating an account if one already exists for the reunion. Return error with instruction to use resume onboarding. Use absolute URLs (`${NEXT_PUBLIC_BASE_URL}/admin/{slug}?connect=...`) for Account Link refresh/return URLs.

**Task 3 (revised)**: Requires admin auth. Write-through pattern: after retrieving account status from Stripe, update `stripeConnectOnboardingComplete`, `stripeConnectChargesEnabled`, and `stripeConnectPayoutsEnabled` in the DB if any have changed. This ensures the DB stays current even if webhooks are delayed.

**Task 4 (revised)**: Requires admin auth. Uses absolute URLs for Account Link refresh/return URLs.

**Task 5 (revised)**: Client component (`connect-status.tsx`) checks URL params on mount. If `?connect=refresh`, calls `/api/admin/connect/onboarding-link` and redirects. If `?connect=complete`, calls `/api/admin/connect/status` (which write-through updates DB including `stripeConnectPayoutsEnabled`) and displays result. UI renders five distinct states: (1) no account, (2) onboarding incomplete, (3) onboarding complete but charges not yet enabled (yellow "Verification pending"), (4) charges enabled but payouts pending (yellow "Bank verification pending"), (5) both charges and payouts enabled (green "Payouts active"). Note: the `charges=false, payouts=true` restricted state is collapsed into state 3 — component must not assume payouts=true implies charges=true.

**Task 6 & 7 (revised)**: Add `payment_intent_data.transfer_data.destination` and `payment_intent_data.on_behalf_of` (both nested under `payment_intent_data`) to Checkout Session creation. Both tasks validate connected account BEFORE any DB writes to prevent orphan records.

**Task 8 (revised)**: Add `STRIPE_CONNECT_WEBHOOK_SECRET` env var. In the webhook handler, try constructing the event with the platform secret first; if that fails, try the Connect secret. This allows a single endpoint to handle both event types. On `account.updated`: treat the webhook as a hint only — call `stripe.accounts.retrieve(event.account)` to get the live state (not the event payload), then update all three DB fields: `stripeConnectOnboardingComplete`, `stripeConnectChargesEnabled`, AND `stripeConnectPayoutsEnabled`. Using live retrieval eliminates ordering-sensitive stale writes. If the retrieve call fails, return 5xx so Stripe retries — never acknowledge with 200 and leave DB stale.

**Task 9 (revised)**: `rsvp/page.tsx` queries `reunion.stripeConnectedAccountId` and `reunion.stripeConnectChargesEnabled`, passes `chargesEnabled` boolean to `RegistrationForm`. Gates on `chargesEnabled` (not onboarding complete, not payoutsEnabled — destination charges are accepted when chargesEnabled=true regardless of payouts state). When chargesEnabled is false, hides the "Pay now" radio option but keeps "Pay at the door" available. Sponsor form is also gated on chargesEnabled.

## Success Criteria
1. Organizer can complete Stripe Express onboarding from the admin panel
2. Registration payments create destination charges that auto-transfer to the connected account
3. Sponsorship payments also route to the connected account
4. Admin panel shows connected account status (not connected / pending / active)
5. Paid registration is blocked when no connected account is set up
6. Existing "cover processing fees" UX continues to work unchanged
7. Webhooks correctly update payment status and onboarding status
