# PLAN: Susy Feedback Implementation

## Context (gathered Step 1)

**Source:** Email feedback from Susy, planning committee member, PHHS Class of 1996 reunion.

**Project state:**
- Branch: `staging` (clean working tree)
- Last commit: `93461fc` Add Stripe Connect: route payments directly to reunion organizer
- Stack: Next.js 16, React 19, Drizzle ORM + Turso/libsql, Stripe Connect (Express + Account Link), Vercel Blob, Tailwind CSS v4
- Site modes: `tease` → `pre_register` → `open`
- Auth: admin password login + edit-token (UUID) for user profiles; no general auth system
- Stripe Connect already wired: admin-initiated, redirect-based onboarding via Account Link, returns to admin page, status-polling component (`connect-status.tsx`)
- Sponsor schema enum values: `"top"` and `"community"` (internal — DB-level; UI labels are independent)

**Susy's key asks:**
1. Refund policy disclosure on payment flows
2. Sponsor tiers renamed to "Trojan Sponsor" / "Community Service Project Sponsor" with explicit recognition language
3. Decision on whether to publish itinerary now (pending finalization) or wait — recommendation is publish now with "details finalizing" note
4. Community service project page: 96 Backpacks, Replenish KC partner charity, Amazon Wish List, tax receipt status
5. Yearbook scrolling/browse view (already exists) and incorporation of paper questionnaires from 10th reunion (out of scope — manual)

**Decisions made:**
- Keep existing Stripe Connect Account Link (Stripe-hosted onboarding) — embedded components dropped as overkill. Verify the existing flow works end-to-end and starts entirely from the admin page.
- Domain purchase out of scope (Ryan handles directly with Susy as a personal donation).
- Old questionnaire bulk import out of scope; manual transcription via existing admin profile-edit tools.
- Itinerary: publish now with a single page-level banner ("details still being finalized") rather than per-event badges.
- Refund policy: prominent above pay buttons; small footnote on confirmation pages.

---

## Self-Audit Summary

The first-draft plan had:
- One BLOCKER (premise wrong on `sponsor-form.tsx` tier-label scan — form doesn't render tier strings)
- Several WARNINGs (under-specified "details finalizing" mechanism; tax-receipt copy promised more than is confirmed; nav-crowding risk; webhook-delivery dependency for Connect verification)
- Several NITs (over-zealous refund policy placement, missing communication item for Susy, missing deployment step)

All findings are incorporated below.

---

## Conductor Plan (revised)

**Objective:** Address Susy's feedback in one shipping pass — refund policy disclosure, sponsor tier renaming, publishable itinerary, community service project page, and verification of admin-initiated Stripe Connect onboarding.

### Scope
- Refund policy copy on payment-flow pages
- Sponsor tier rename ("Trojan Sponsor" / "Community Service Project Sponsor") with recognition language
- Itinerary: seed the four events + page-level "details finalizing" banner on `/schedule`
- New `/community-service` page: 96 Backpacks, Replenish KC, Amazon Wish List link slot, tax receipt status
- End-to-end verification of Stripe Connect onboarding flow (admin-initiated, Stripe-hosted)
- Light copy polish on `connect-status.tsx` if test pass surfaces issues
- Documentation refresh

### Out of Scope
- Domain purchase (Ryan + Susy handle directly)
- Stripe Connect Embedded Components
- Old questionnaire bulk import
- Email notifications
- Yearbook redesign (existing scrolling grid + profile form satisfy the ask)
- Admin event-editing UI (flagged as v2 follow-up)

### Files Affected

**Modify:**
- `src/lib/constants.ts` — add `REFUND_POLICY_TEXT` constant; add comment near `getSponsorTier()` mapping internal enum to UI labels; add `getSponsorTierLabel(tier)` helper returning the public label for a given enum value
- `src/components/registration-form.tsx` — refund policy above pay button (conditional on `hasPaidEvent && payNow && chargesEnabled` only)
- `src/components/sponsor-form.tsx` — refund policy above sponsor button
- `src/app/[slug]/confirmation/page.tsx` — refund policy footer note (only when payment was actually charged)
- `src/app/[slug]/sponsor/confirmation/page.tsx` — refund policy footer note
- `src/app/[slug]/sponsor/page.tsx` — tier rename, recognition copy, link to community service page
- `src/app/[slug]/sponsors/page.tsx` — public-facing tier labels, recognition copy
- `src/app/[slug]/schedule/page.tsx` — page-level "details finalizing" banner
- `src/app/[slug]/page.tsx` — add community service section/CTA below HelpSection (or another place that fits the visual rhythm — TBD per layout reading)
- `src/components/site-nav.tsx` — add "Community Service" link (modes: `pre_register`, `open`)
- `src/lib/db/seed-events.ts` — refactor to be idempotent (UPSERT-style) and stop forcibly setting `siteMode = "tease"`; replace `eventLocation: "TBD"` placeholder with `null` so the finalizing banner detects unfinalized fields
- `src/app/admin/[slug]/admin-tabs.tsx` — rename sponsor tier badge labels ("Top" → "Trojan", "Community" → "Community Service")
- `src/app/api/sponsor-checkout/route.ts` — update Stripe Checkout `product_data.name` to use the new tier labels (visible on Stripe-hosted checkout page + receipts)
- `docs/stripe-connect-setup.md` — refresh if verification surfaces drift
- `.env.example` — add `NEXT_PUBLIC_AMAZON_WISHLIST_URL` placeholder

**Create:**
- `src/app/[slug]/community-service/page.tsx` — new community service page

### Micro-Tasks (atomic, sequential)

#### Phase A — Refund Policy Disclosure

| # | Task | Agent |
|---|------|-------|
| 1 | Add `export const REFUND_POLICY_TEXT = "All payments are final. No refunds will be issued."` to `src/lib/constants.ts` | Code |
| 2 | In `src/components/registration-form.tsx`, render `REFUND_POLICY_TEXT` as a **clearly visible** disclosure (`text-sm text-gray-700` inside an amber-tinted `bg-amber-50 border border-amber-200 rounded-md px-3 py-2`) directly above the submit button **conditional on `hasPaidEvent && payNow && chargesEnabled`** — so it does NOT appear when registering for free events or selecting "pay at the door". Position it immediately above the existing `flex gap-3` button row near the bottom of the form (around line 453). Prominence is intentional per product decision (disclosure must not look like fine print) | Code |
| 3 | Render `REFUND_POLICY_TEXT` as a **clearly visible** disclosure (`text-sm text-gray-700` inside an amber-tinted `bg-amber-50 border border-amber-200 rounded-md px-3 py-2`) directly above the submit button in `src/components/sponsor-form.tsx` (sponsor flow always charges, so unconditional is fine) | Code |
| 4 | In `src/app/[slug]/confirmation/page.tsx`, render `REFUND_POLICY_TEXT` as a `text-xs text-gray-400` footer note **only when `rsvp?.paymentMethod === "online"`** (mirrors the existing `isPaid` predicate on line 75 of that file). This avoids the case where Stripe redirects the user back before the webhook has updated `paymentStatus` to `"paid"` — the user might miss the disclosure on the very page where they expect it. Free / pay-at-door registrations correctly skip it | Code |
| 5 | Render `REFUND_POLICY_TEXT` as a `text-xs text-gray-400` footer note at the bottom of `src/app/[slug]/sponsor/confirmation/page.tsx` (sponsor flow always charges) | Code |

**Success:** Refund policy is visible above every Stripe-initiating button and as a quiet footer on confirmation pages, scoped to flows where money actually changed (or will change) hands.

#### Phase B — Sponsor Tier Rename + Recognition Copy

| # | Task | Agent |
|---|------|-------|
| 6 | In `src/app/[slug]/sponsor/page.tsx`, change tier card heading "Top Sponsor" → "Trojan Sponsor" | Code |
| 7 | In `src/app/[slug]/sponsor/page.tsx`, change tier card heading "Community Service Sponsor" → "Community Service Project Sponsor" | Code |
| 8 | Update `src/app/[slug]/sponsor/page.tsx` Trojan tier card body to: "Recognized online and on signage at select reunion events. Helps offset event costs to keep ticket prices low for everyone." | UX + Code |
| 9 | Update `src/app/[slug]/sponsor/page.tsx` Community Service Project Sponsor card body to: "Recognized online. Funds the 96 Backpacks community service project — giving back to Park Hill schools." Include a `Link` to `/{slug}/community-service` ("Learn more →") | UX + Code |
| 10 | Apply the same two label renames + recognition copy in `src/app/[slug]/sponsors/page.tsx` (the public-facing list page) — section headings ("Top Sponsors" → "Trojan Sponsors", "Community Service Sponsors" → "Community Service Project Sponsors") and any inline tier strings | Code |
| 11 | Add `getSponsorTierLabel()` helper to `src/lib/constants.ts` returning `"Trojan"` for `"top"` and `"Community Service"` for `"community"` (short form, used in admin badges). Add the comment above `getSponsorTier()`: `// Internal DB enum values "top" / "community" — UI labels: "Trojan Sponsor" / "Community Service Project Sponsor"` | Code |
| 12 | In `src/app/admin/[slug]/admin-tabs.tsx` (around line 260), replace the hard-coded `s.tier === "top" ? "Top" : "Community"` badge with `getSponsorTierLabel(s.tier)` | Code |
| 13 | In `src/app/api/sponsor-checkout/route.ts` (around line 87), update the Stripe Checkout `product_data.name` to use the new public tier labels (`Trojan Sponsorship` / `Community Service Project Sponsorship`). This text appears on Stripe-hosted Checkout and on email receipts | Code |
| 14 | Audit pass: grep for `"Top Sponsor"`, `"Community Service Sponsor"`, `"Top "` (in sponsor context), and any string literals built from `tier === "top"` ternaries in `src/`. Resolve any stragglers. Exclude DB-only paths (`schema.ts`, `seed-test.ts` test fixtures keep enum values) | Audit |

**Success:** All user-facing tier labels — sponsor pages, sponsors list page, admin tabs, and Stripe-hosted Checkout product names — show the new "Trojan" / "Community Service Project" wording. DB enum unchanged. No stale "Top" / "Community Service Sponsor" strings remain in user-facing code paths.

#### Phase C — Itinerary Publication

| # | Task | Agent |
|---|------|-------|
| 15 | Refactor `src/lib/db/seed-events.ts` so it (a) **does not** force `siteMode` to anything (remove the unconditional `update(reunions).set({ siteMode: "tease" })`), (b) becomes idempotent: if the four events already exist (matched by `slug` per reunion), update their fields in place instead of `process.exit(0)`, and (c) **safely prunes pre-existing events whose slug is not in the canonical four-slug set** (`friday-tailgate`, `friday-bar`, `saturday-service`, `saturday-banquet`). **FK-safe pruning rules:** `registration_events.eventId` and `event_interests.eventId` both reference `events.id` without `ON DELETE CASCADE` (see `src/lib/db/schema.ts` lines 137-153 and 182-201). Therefore for each non-canonical event found, the seed must (1) count dependent rows in `registrationEvents` and `eventInterests` for that `eventId`, (2) delete the event row only if BOTH dependent counts are zero, and (3) for non-canonical events with dependents, skip the delete and **log a clear warning** (`event.slug`, `event.id`, dependent counts) so an admin can decide whether to clean up manually. This avoids silently destroying live signup data. Wrap mutations in a transaction so partial failures don't half-mutate the schedule. Print an end-of-run summary: `{ inserted, updated, deleted, skipped: [{ slug, signups, interests }] }` | Code |
| 16 | Edit the event data inside `src/lib/db/seed-events.ts` to define the four events: (a) Friday tailgate at PHHS (slug `friday-tailgate`), (b) Friday at Kelly Barges (slug `friday-bar`), (c) Saturday morning 96 Backpacks community service (slug `saturday-service`), (d) Saturday banquet (slug `saturday-banquet`). **Strict content rule: any field that is not yet confirmed (`eventTime`, `eventLocation`, `eventAddress`) must be `null` — never `"TBD"` or other placeholder text.** This is what the schedule banner detects. Confirm `sortOrder` reflects chronological order | Code |
| 17 | In `src/app/[slug]/schedule/page.tsx`, add a single page-level banner above the events list: amber `bg-amber-50 border-amber-200`, text "Details for these events are still being finalized — check back as we lock in the schedule." **Predicate scope: evaluate ONLY the four canonical itinerary slugs** (`friday-tailgate`, `friday-bar`, `saturday-service`, `saturday-banquet`) — define a top-level `const ITINERARY_SLUGS = [...]` constant. Render the banner if any event whose `slug` is in `ITINERARY_SLUGS` has at least one null among `eventTime`, `eventLocation`, `eventAddress`. This avoids false positives from extra/manual events admins may add later. Add a code comment near the predicate explaining the null-only contract (no placeholder strings) and the slug-scoped check | Code |
| 18 | Run `npm run db:seed-events` against the staging database to populate / refresh the four events. Verify in admin that (a) no reunion's `siteMode` was unexpectedly changed, (b) the events table contains exactly the four canonical slugs (extras pruned), and (c) `/schedule` renders exactly four events | Code |

**Success:** `/schedule` lists exactly the four canonical events (extras pruned by seed); the "finalizing" banner appears while any of the four canonical events has missing `eventTime` / `eventLocation` / `eventAddress` and disappears automatically once all four are filled. Re-running the seed script is safe, idempotent, and does not regress site mode. The seed wraps its mutations in a transaction.

#### Phase D — Community Service Page

| # | Task | Agent |
|---|------|-------|
| 19 | Create `src/app/[slug]/community-service/page.tsx`. Include: page title "Community Service Project: 96 Backpacks", project description paragraph, partner-charity paragraph naming Replenish KC and the Park Hill schools delivery target, an Amazon Wish List CTA section that reads `NEXT_PUBLIC_AMAZON_WISHLIST_URL` and renders either a `<Link>` button ("Donate items via Amazon Wish List →") or fallback text ("Wish list coming soon — check back!"), and a tax-receipt paragraph: "Tax receipt eligibility for charitable contributions and donated items is being confirmed with our partner charity. We'll update this page once we have details." Extract project name into a local `PROJECT_NAME` constant at top of file for one-line edits later | UX + Code |
| 20 | Add `NEXT_PUBLIC_AMAZON_WISHLIST_URL=` (empty) to `.env.example` with a comment explaining its use | Code |
| 21 | Add nav link to `src/components/site-nav.tsx`: `{ label: "Community Service", href: \`/${slug}/community-service\`, modes: ["pre_register", "open"] }` between "Yearbook" and "Memorial" | Code |
| 22 | Add a community service section to `src/app/[slug]/page.tsx`: a single full-width card below `<HelpSection>` with project headline, one-line summary, and a "Learn about 96 Backpacks →" link. Visible in `pre_register` and `open` modes | UX + Code |

**Success:** A `/community-service` page exists, is reachable from nav and homepage, renders correctly with or without the wish list URL set, and accurately reflects unconfirmed tax receipt status.

#### Phase E — Stripe Connect Verification

**Important precondition:** `connect-status.tsx` does NOT currently poll on an interval — it does a single `refreshStatus()` call when `?connect=complete` is present, then stops. Plan claims of "polling fallback" are inaccurate. Phase E accepts the manual-refresh model for now (webhook + single post-return refresh covers the happy path); adding interval polling is explicitly deferred to a follow-up. The decision is documented in Risk Areas below and in task 26 (docs update).

| # | Task | Agent |
|---|------|-------|
| 23 | In Stripe test mode, simulate a fresh organizer onboarding **with the Stripe CLI forwarding webhooks to localhost**: run `stripe listen --forward-to localhost:3000/api/webhooks/stripe --events checkout.session.completed,checkout.session.expired,account.updated` in a terminal. Then log in as admin → `/admin/[slug]` → click "Set up payouts" → complete Stripe-hosted onboarding (test data) → return to admin page → confirm the `account.updated` event is **observed in the Stripe CLI output AND the corresponding DB row's `stripeConnectChargesEnabled` / `stripeConnectPayoutsEnabled` flips to true**. Registration of the production webhook in the dashboard is NOT a substitute — actual delivery must be observed end-to-end | Audit |
| 24 | After webhook delivery is confirmed, hard-refresh `/admin/[slug]` and verify the status badge transitions to "Payouts active". (Note: page does not auto-poll; manual refresh is expected behavior.) If status doesn't update, file a separate bug — do not paper over with code changes here | Audit |
| 25 | If step 23 or 24 surfaces any unclear copy (e.g., ambiguous status messages, confusing button labels), polish copy in `src/components/connect-status.tsx`. Functional changes (e.g., adding interval polling) are out of scope for this plan — file separately if needed | Code |
| 26 | Update `docs/stripe-connect-setup.md` if verification surfaces any documentation drift. Specifically, add a note clarifying that the admin page does not auto-poll status — the user should refresh after Stripe finishes verification, OR rely on the post-return one-shot refresh | Code |

**Success:** An admin can complete the entire Stripe Connect onboarding starting from `/admin/[slug]` without ever being handed a Stripe URL out-of-band. A real `account.updated` webhook is observed reaching the endpoint and updating the DB. The status badge reflects "active" after the post-return refresh (or a manual page refresh). If anything is unclear in the UI, copy is tightened. Auto-polling is explicitly deferred.

#### Phase F — Build, QA, Wrap

| # | Task | Agent |
|---|------|-------|
| 27 | Run `npm run build` to confirm no TypeScript or build errors | Audit |
| 28 | Manual QA pass on staging covering: `/`, `/[slug]`, `/[slug]/rsvp`, `/[slug]/sponsor`, `/[slug]/sponsors`, `/[slug]/schedule`, `/[slug]/community-service`, `/admin/[slug]`. Check refund policy visibility (must be visually prominent above pay buttons, not fine-print muted), tier names, recognition copy, schedule banner trigger, community service page in both wish-list-set and wish-list-unset states. Verify mobile nav (sm/iPhone viewport) doesn't crowd or wrap awkwardly with the added link | Audit |
| 29 | Draft a one-paragraph reply email for Susy with: domain confirmation (Ryan donating), recap of changes shipped, note that old questionnaire integration will be handled manually after registration opens, and ask for the Amazon Wish List URL when she has it | Communications |

**Success:** Build green, manual QA confirms every checklist item, and Susy receives a clear status update with one open ask (wish list URL).

### Dependencies

```
Phase A 1 → 2, 3, 4, 5                       (constant first; 2-5 independent of each other)
Phase B 6, 7 → 8, 9 → 10 → 11 → 12, 13 → 14  (rename labels → recognition copy → propagate to public list → helper → admin badge + checkout product name → grep audit)
Phase C 15, 16 → 17 → 18                     (seed refactor + event data → schedule banner predicate → run seed)
Phase D 19 → 20, 21, 22                      (page first; env + nav + homepage CTA in parallel)
Phase E 23 → 24 → 25, 26                     (webhook delivery verification → status refresh check → copy polish + doc update)
Phase F 27 (depends on A–E) → 28 → 29        (build → QA → comms)
```

### Success Criteria (rolled up)

1. ✅ Refund policy ("All payments are final. No refunds will be issued.") is **visibly prominent** (amber callout, not muted fine print) above every Stripe pay button, and a quiet footer on confirmation pages — gated to actually-paid online flows (using `paymentMethod === "online"` so the disclosure is present even if webhook is delayed)
2. ✅ Both sponsor pages display "Trojan Sponsor" and "Community Service Project Sponsor" with explicit "recognized online and on signage" / "recognized online; funds the 96 Backpacks project" copy
3. ✅ `/schedule` shows exactly the four canonical events (extras pruned by seed) with a single page-level "details finalizing" banner that auto-clears when all `eventTime` / `eventLocation` / `eventAddress` fields on all four canonical events are filled
4. ✅ `/community-service` page exists, is linked from nav (in appropriate modes) and homepage, and renders gracefully whether the Amazon Wish List URL is set or not
5. ✅ A fresh admin can complete Stripe Connect onboarding entirely starting from `/admin/[slug]` (no out-of-band Stripe URL); a real `account.updated` webhook is observed reaching the endpoint and updating DB flags; status badge reflects "active" after the post-return refresh (manual-refresh model — auto-polling deferred)
6. ✅ `npm run build` exits clean
7. ✅ Mobile QA confirms no nav crowding or layout breakage on sm viewports
8. ✅ Susy receives a clear written reply summarizing what shipped and one open ask

### Risk Areas

- **Schedule banner trigger:** Logic depends on null-field detection scoped to the four canonical itinerary slugs (`ITINERARY_SLUGS`). Once admins fill all three fields on all four events, the banner must vanish — tested in step 28. Extra events (added manually by admins later) intentionally do NOT trigger the banner
- **Seed prunes non-canonical events:** Phase C's seed deletes events whose slug is not in the canonical set. Risk: if an admin manually creates a fifth event and someone re-runs the seed, that event is deleted. Mitigation: seed prints a deletion summary; once admin event-editing UI ships in v2 the seed should become read-only on staging
- **Sponsor tier DB enum mismatch:** Schema uses `"top"`/`"community"` internally. Mitigated by comment in constants.ts (task 11) and explicit grep (task 14)
- **Amazon Wish List link:** Susy doesn't have it yet. Page must render correctly with empty env var — tested explicitly in step 28
- **Tax receipts:** Copy explicitly says "being confirmed" not "available" — avoids overclaiming
- **96 Backpacks naming:** Working name extracted to a `PROJECT_NAME` constant in the page — one-line update if committee picks a different name
- **Stripe webhook delivery:** `connect-status.tsx` does NOT poll on an interval — it does one `refreshStatus()` call when `?connect=complete` is present in the URL, then stops. So if `account.updated` is delayed past that single check, the admin must manually refresh `/admin/[slug]` to see the updated status. Phase E task 23 explicitly verifies real webhook delivery via Stripe CLI; task 24 verifies the refresh path works. Adding interval polling is deferred (file separately if needed)
- **Mobile nav crowding:** A 6th nav link risks breakage on small viewports — explicit visual QA in step 28
- **Homepage layout:** Adding a community service section may compete with existing CTA. Task 22 keeps it below `HelpSection` to maintain the registration CTA's prominence

### Communications (Susy reply, draft)

> Susy — thanks for the thoughtful notes! Quick rundown of what's now live (or about to be):
>
> - **Domain:** I'm covering it — no cost to the committee
> - **Refund policy:** "All payments are final" is now displayed on every payment screen and confirmation page
> - **Sponsorship:** Renamed to "Trojan Sponsor" and "Community Service Project Sponsor," with explicit copy that sponsors are recognized online and on signage at select reunion events
> - **Itinerary:** Bullets are published now with a "details still being finalized" banner — we can update as you finalize logistics
> - **Community Service Project:** Dedicated page for **96 Backpacks** is live. It mentions Replenish KC as the partner charity. **One open ask:** send me the Amazon Wish List URL when ready and I'll plug it in. Tax receipts: copy says "being confirmed" — let me know once you hear back from Replenish KC and I'll update
> - **Yearbook:** The browse-by-classmate scrolling page already exists. For the old paper questionnaires from the 10th reunion, simplest path is for committee to manually paste those answers into a classmate's profile after they register — happy to walk through how
>
> Anything else you want to see before going live?

---

## End of Plan
