# Plan: PHHS '96 Reunion Site — Full Build-Out

## Context

The PHHS Class of 1996 reunion site currently has a basic RSVP/pre-registration flow, Stripe payment, and admin panel. The reunion planning committee has defined a much richer event structure (Friday tailgate + bar, Saturday service + banquet), wants to collect sponsors immediately, and needs the site to launch in "tease" mode — building excitement and collecting interest/sponsors before the full schedule and registration open.

This plan expands the site from a simple RSVP tool into a full reunion platform: marketing tease mode, sponsorship system, multi-event registration, digital yearbook profiles, and an in memoriam section.

**Tech stack:** Next.js 16, Tailwind 4, Drizzle ORM, Turso (LibSQL), Stripe, Vercel. Zero-cost hosting.

---

## Key Design Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Site mode control** | Replace `registrationOpen` boolean with `siteMode` enum (`tease`, `pre_register`, `open`) | More expressive; covers all three states the site needs |
| **User profiles / return editing** | UUID `editToken` on `rsvps` table; link `/{slug}/profile/{token}` shown post-registration and on confirmation page | No auth system needed. Unguessable token. Token recovery is admin-only in v1 (no public resend endpoint) |
| **Image uploads** | Vercel Blob (`@vercel/blob`) | One package, one env var, 250MB free tier, native Vercel integration |
| **Yearbook PDF** | Print-friendly HTML page with `@media print` styles | Zero dependencies, guaranteed to work. Browser print-to-PDF is good enough for v1 |
| **Memorial workflow** | Status enum: `submitted` → `draft` → `pending_review` → `published`. On submitter "request changes": `pending_review` → `draft` (sets `reviewNotes` + `reviewedAt`). Admin edits, re-sends for review. Admin copies review link manually | Simple state machine. No email integration needed for v1 |
| **Sponsorship collection** | Stripe checkout through Ryan's business entity | Clean audit trail, defensible, already integrated |
| **Sponsor tier threshold** | Top Sponsor: >= $500; Community Service Sponsor: < $500. Threshold stored as a constant in the codebase, not in the DB | Single source of truth for tier classification across form, API, admin, and sponsor wall |
| **Interest vs pre-registration** | Separate `interestSignups` table (lightweight email capture) from `rsvps` table (full registration) | Different data, different lifecycle |

---

## Scope

**In scope:**
- Tease landing page with interest capture + sponsor CTA
- Sponsorship system (form, Stripe payment, logo upload, sponsor wall)
- Events data model + schedule page
- Multi-step registration with event selection + banquet payment (early-bird vs standard)
- Digital yearbook: profile questionnaire, browsable directory, print-friendly view
- Memorial: submission form, admin review workflow, display page
- Admin panel expansion (site mode, interests, sponsors, memorials, profiles, events)
- Navigation and layout updates
- Schema migration, seed data update

**Out of scope:**
- Email sending (admin handles notifications manually for v1)
- Designed PDF generation (print-friendly HTML only)
- User authentication (edit tokens only)
- Multi-reunion admin UI (slug model supports it, but only one reunion now)
- Payment for non-banquet events (interest-only)
- Mobile app

---

## Micro-Tasks

### Phase 0: Schema Foundation

**0.1** Add `siteMode` column to `reunions` table: `text("site_mode", { enum: ["tease", "pre_register", "open"] }).notNull().default("tease")`. Keep `registrationOpen` for backward compat during migration; all new code reads `siteMode`.
- File: `src/lib/db/schema.ts`

**0.2** Create `events` table: `id`, `reunionId` (FK), `name`, `slug`, `description`, `eventDate`, `eventTime`, `eventLocation`, `eventAddress`, `type` (`interest_only` | `paid`), `priceCents` (nullable), `earlyPriceCents` (nullable), `earlyPriceDeadline` (nullable), `sortOrder`, `createdAt`, `updatedAt`.
- File: `src/lib/db/schema.ts`

**0.3** Create `interestSignups` table: `id`, `reunionId` (FK), `email`, `firstName` (nullable), `lastName` (nullable), `createdAt`. **Unique** constraint on `(reunionId, email)` to support upsert behavior.
- File: `src/lib/db/schema.ts`

**0.4** Create `eventInterests` junction table: `id`, `interestSignupId` (FK), `eventId` (FK). Unique constraint on `(interestSignupId, eventId)`. Tracks which events each interest signup cares about.
- File: `src/lib/db/schema.ts`

**0.5** Create `sponsors` table: `id`, `reunionId` (FK), `contactName`, `contactEmail`, `contactPhone` (nullable), `companyName`, `logoUrl` (nullable), `websiteUrl` (nullable), `amountCents`, `tier` (`top` | `community`), `message` (nullable — personal note from sponsor), `stripeCheckoutSessionId` (nullable), `paymentStatus` (`pending` | `paid` | `failed`), `isDisplayed` (boolean, default false), `createdAt`, `updatedAt`.
- File: `src/lib/db/schema.ts`

**0.6** Create `profiles` table: `id`, `rsvpId` (FK to rsvps, unique), `currentCity` (nullable), `occupation` (nullable), `family` (nullable), `favoritePHMemory` (nullable), `beenUpTo` (nullable), `funFact` (nullable), `photoUrl` (nullable), `isPublished` (boolean, default true), `createdAt`, `updatedAt`. Note: name/email come from the linked rsvp. Edit token lives on `rsvps` only (see 0.9) — do NOT duplicate it here.
- File: `src/lib/db/schema.ts`

**0.7** Create `memorials` table: `id`, `reunionId` (FK), `deceasedFirstName`, `deceasedLastName`, `deceasedPhotoUrl` (nullable), `yearOfBirth` (nullable), `yearOfDeath` (nullable), `tributeText`, `submitterName`, `submitterEmail`, `submitterPhone` (nullable), `submitterRelationship` (nullable), `reviewToken` (unique UUID), `status` (`submitted` | `draft` | `pending_review` | `published`), `adminDraft` (nullable, JSON text — admin's edited version of all publishable fields: deceasedFirstName, deceasedLastName, deceasedPhotoUrl, yearOfBirth, yearOfDeath, tributeText), `reviewNotes` (nullable — submitter's feedback when requesting changes), `reviewedAt` (nullable — timestamp of last submitter review), `createdAt`, `updatedAt`.
- File: `src/lib/db/schema.ts`

**0.8** Create `registrationEvents` junction table: `id`, `rsvpId` (FK to rsvps), `eventId` (FK to events). Unique constraint on `(rsvpId, eventId)`. Tracks which events a registrant selected.
- File: `src/lib/db/schema.ts`

**0.9** Add `editToken` column (text, unique, nullable) to existing `rsvps` table. Add `paymentMethod` column: `text("payment_method", { enum: ["online", "door"] }).default("online")` — distinguishes intentional pay-later registrations from abandoned Stripe checkouts.
- File: `src/lib/db/schema.ts`

**0.10** Export all new TypeScript types from schema.ts.
- File: `src/lib/db/schema.ts`

**0.11** Update `seed.ts`: set `siteMode: "tease"` on the reunion, create the four events (Friday Tailgate, Friday Bar, Saturday Service, Saturday Banquet with pricing).
- File: `src/lib/db/seed.ts`

**0.12** Run `drizzle-kit push` to apply schema changes.

### Phase 1: Tease Mode Landing Page

**1.1** Create `src/components/tease-landing.tsx`: visually engaging hero with reunion name/date, excitement-building copy, countdown to Aug 28 2026, and two CTAs: "I'm Interested" (opens interest form) and "Become a Sponsor" (links to `/{slug}/sponsor`).

**1.2** Create `src/components/interest-form.tsx`: modal form collecting email, optional first/last name, checkboxes for events they're interested in. Posts to `/api/interest`. Handles duplicate emails gracefully (upsert).

**1.3** Create `src/app/api/interest/route.ts`: validates input, upserts into `interestSignups`, inserts `eventInterests` rows (delete old + re-insert for upsert case). Returns success.

**1.4** Modify `src/app/[slug]/page.tsx`: check `reunion.siteMode`. If `"tease"` → render `TeaseLanding`. If `"pre_register"` or `"open"` → render current landing page (with appropriate CTA text). Pass events list to TeaseLanding for interest checkboxes.

### Phase 2: Sponsorship System

**2.1** Install `@vercel/blob` package.

**2.2** Create `src/lib/upload.ts`: shared upload helper that validates image types (jpg/png/gif/webp/svg), max 2MB, and uploads to Vercel Blob. Do NOT create a generic public `/api/upload` endpoint — instead, each feature's API route handles its own upload inline (sponsor logo in `/api/sponsor-checkout`, profile photo in `/api/profile`, memorial photo in `/api/memorial`). This prevents unauthenticated abuse of a public upload endpoint on free-tier Blob storage. Add basic rate limiting per IP (e.g., 10 uploads/minute).

**2.3** Create `src/app/[slug]/sponsor/page.tsx`: explains the two tiers with clear messaging (not tax-deductible, sponsor recognition on the site), renders sponsor form.

**2.4** Create `src/components/sponsor-form.tsx`: collects contact name, email, phone, company name, website URL, sponsorship amount (with dynamic tier indicator showing "Top Sponsor" vs "Community Service Sponsor" based on amount), logo upload, optional personal message. Submits to `/api/sponsor-checkout`.

**2.5** Create `src/app/api/sponsor-checkout/route.ts`: creates sponsor record in DB with `paymentStatus: "pending"`, determines tier from amount, creates Stripe checkout session with `sponsor_id` in metadata, returns checkout URL.

**2.6** Update `src/app/api/webhooks/stripe/route.ts`: add handler for sponsor payments in both `checkout.session.completed` (update `paymentStatus` to `"paid"`) and `checkout.session.expired` (update `paymentStatus` to `"failed"`). Check for `sponsor_id` in metadata to distinguish from rsvp payments. Keep existing `rsvp_id` handling.

**2.7** Create `src/app/[slug]/sponsor/confirmation/page.tsx`: thank-you page after sponsor payment.

**2.8** Create `src/app/[slug]/sponsors/page.tsx`: displays approved sponsors (`isDisplayed: true`) grouped by tier. Top sponsors get larger cards with logos. Community sponsors listed below.

### Phase 3: Multi-Event Registration

**3.0** Add server-side `siteMode` enforcement. Create a shared helper `assertSiteMode(reunionId, allowedModes)` that throws a 403 if the reunion's current `siteMode` is not in the allowed list. Apply as follows:
- `/api/checkout` and `/api/register`: only allowed when `siteMode === "open"`
- `/api/interest`: allowed in all modes (interest capture always works)
- `/{slug}/rsvp` page: redirects to landing if `"tease"`; shows interest form if `"pre_register"`; shows full registration if `"open"`
- `/{slug}/schedule`, `/{slug}/yearbook`, `/{slug}/memorial`, `/{slug}/memorial/submit` pages: only accessible when `siteMode !== "tease"` (redirect to landing in tease mode). `/{slug}/memorial/review/[token]` is always accessible (private UUID link for submitter review). Sponsor page (`/{slug}/sponsor`) is accessible in all modes.
- File: `src/lib/site-mode.ts` (helper), then update each route/page

**3.1** Create `src/app/[slug]/schedule/page.tsx`: displays all events for the reunion in chronological order. Each event shows: name, date/time, location, description, type indicator (e.g., "Free" vs ticket price). Links to register.

**3.2** Create `src/components/registration-form.tsx`: multi-step form replacing current RsvpForm + PreRegisterForm.
- Step 1: Basic info (first name, last name, email, phone, guest count)
- Step 2: Event selection — checkboxes for each event. If Saturday banquet checked, show pricing: "Pay now: $X (early bird)" vs "Pay at the door: $Y"
- Step 3: If paying now → Stripe checkout (existing flow with event selections added). If pay later → confirm registration.
- After submit: success screen with link to yearbook profile

**3.3** Update `src/app/[slug]/rsvp/page.tsx`: fetch events and `siteMode` for the reunion. In `open` mode, render `RegistrationForm` with full event selection and payment. In `pre_register` mode, render `InterestForm` (from 1.2) pre-filled for the registration context — submits to `/api/interest`, not `/api/register` or `/api/checkout`. In `tease` mode, redirect to landing page (enforced by 3.0 helper).

**3.4** Create `src/app/api/register/route.ts`: handles "pay at the door" registrations. Validates that all submitted `eventId`s belong to the current reunion and exist. Creates rsvp with `paymentStatus: "pending"` and `paymentMethod: "door"`, generates `editToken`, inserts `registrationEvents` rows inside a transaction. Returns success + editToken URL.

**3.5** Update `src/app/api/checkout/route.ts`: accept event selections, validate that all `eventId`s belong to the current reunion and exist. Store ALL selected events in `registrationEvents` (both `paid` and `interest_only`). Only create Stripe line items for events with `type === "paid"` — apply early-bird price logic (compare current date to `earlyPriceDeadline`). Generate `editToken` (store on the rsvp record). Include `editToken` in Stripe session metadata so the confirmation page can retrieve it after redirect.

**3.6** Update `src/app/[slug]/confirmation/page.tsx`: for paid registrations, retrieve the RSVP by `stripeCheckoutSessionId` (from `session_id` query param) to get the `editToken`. For pay-later registrations, `editToken` is passed directly via query param. Show selected events and a gentle CTA to fill out yearbook profile with link to `/{slug}/profile/{editToken}`.

### Phase 4: Digital Yearbook

**4.1** Create `src/app/[slug]/profile/[token]/page.tsx`: looks up rsvp by `editToken`, renders profile form pre-filled with any existing profile data. Does NOT create a profile record on page load (avoids mutation from prefetching/crawlers). Profile record is created on first explicit save via the `/api/profile` POST handler.

**4.2** Create `src/components/profile-form.tsx`: optional fields — current city, occupation, family, favorite PH memory, what you've been up to, fun fact, photo upload. All fields optional. Autosave or explicit save button.

**4.3** Create `src/app/api/profile/route.ts`: POST to create/update profile. Validates edit token ownership. Handles photo upload via Vercel Blob.

**4.4** Create `src/app/[slug]/yearbook/page.tsx`: grid of published profiles with photos, names, current city. Click to expand or view detail. Searchable/filterable by name.

**4.5** Create `src/app/[slug]/yearbook/[profileId]/page.tsx`: full profile view for one classmate.

**4.6** Remove public profile resend endpoint. Edit token recovery is admin-only: admin looks up the rsvp in the admin panel and copies the profile edit URL to share with the classmate manually. This prevents token leakage via email enumeration. (A future version with email verification could re-add a self-service flow.)

**4.7** Create `src/app/[slug]/yearbook/print/page.tsx`: print-friendly layout with `@media print` styles. All profiles rendered as a directory. User does browser print → PDF.

### Phase 5: Memorial Section

**5.1** Create `src/app/[slug]/memorial/page.tsx`: displays all published memorials. Respectful design — muted colors, thoughtful typography. Link to submission form.

**5.2** Create `src/components/memorial-form.tsx`: collects deceased classmate info (first/last name, year of birth/death, photo), tribute text, and submitter contact info (name, email, phone, relationship). All submitter info clearly labeled as "for committee use only."

**5.3** Create `src/app/[slug]/memorial/submit/page.tsx`: renders memorial form with respectful framing.

**5.4** Create `src/app/api/memorial/route.ts`: POST to create memorial with status `"submitted"`, generates `reviewToken`.

**5.5** Create `src/app/[slug]/memorial/review/[token]/page.tsx`: submitter views the admin-drafted entry. Can approve (→ `published`) or leave a note requesting changes.

**5.6** Create `src/app/api/memorial/review/route.ts`: POST with review token to approve or request changes.

### Phase 6: Admin Panel Expansion

**6.1** Create `src/components/site-mode-toggle.tsx`: three-state toggle (tease / pre-register / open) replacing `RegistrationToggle`. Shows current mode with description.

**6.2** Create `src/app/api/admin/site-mode/route.ts`: updates `siteMode` on the reunion.

**6.3** Refactor `src/app/admin/[slug]/page.tsx` into tabbed layout: Overview, RSVPs, Interest Signups, Sponsors, Memorials, Profiles, Events.

**6.4** Build interest signups tab: table of signups with email, name, event preferences, date. Export-friendly.

**6.5** Build sponsors tab: table with company name, contact, amount, tier, payment status, `isDisplayed` toggle.

**6.6** Create `src/app/api/admin/sponsors/route.ts`: toggle `isDisplayed`, other sponsor admin actions.

**6.7** Build memorials tab: table with deceased name, submitter, status. Edit button opens inline editor for admin to draft entry. "Send for review" button (generates review URL admin can copy/share — v1 no email).

**6.8** Create `src/app/api/admin/memorial/route.ts`: update memorial content, change status.

**6.9** Build events tab: list events with interest counts and registration counts. Registration counts must join through `rsvps` and filter by `paymentStatus = "paid"` OR `paymentMethod = "door"` to exclude abandoned online checkouts. Show both "confirmed" and "pending" counts separately.

**6.10** Build profiles tab: list profiles with name, completion status, `isPublished` toggle.

**6.11** Create `src/app/api/admin/profiles/route.ts`: toggle `isPublished`.

### Phase 7: Navigation & Layout

**7.1** Create `src/components/site-nav.tsx`: responsive navigation for public site. Links shown conditionally based on `siteMode`: tease mode shows only Sponsors; pre_register/open shows Schedule, Sponsors, Yearbook, Memorial.

**7.2** Create `src/app/[slug]/layout.tsx`: wraps all `[slug]/*` pages with shared nav and footer. Fetches reunion data for nav context.

**7.3** Update `src/app/layout.tsx`: make metadata dynamic.

**7.4** Update `next.config.ts`: add Vercel Blob image domain to allowed list.

---

## Files Affected

### Modified
- `src/lib/db/schema.ts` — all new tables + reunions modifications
- `src/lib/db/seed.ts` — events + siteMode
- `src/app/[slug]/page.tsx` — siteMode branching
- `src/app/[slug]/rsvp/page.tsx` — new registration form
- `src/app/[slug]/confirmation/page.tsx` — event summary + yearbook CTA
- `src/app/api/checkout/route.ts` — event selections + early-bird + editToken
- `src/app/api/webhooks/stripe/route.ts` — sponsor payment handling
- `src/app/admin/[slug]/page.tsx` — tabbed layout with all new sections
- `src/app/layout.tsx` — dynamic metadata
- `next.config.ts` — image domains
- `package.json` — @vercel/blob dependency

### Created
- `src/components/tease-landing.tsx`
- `src/components/interest-form.tsx`
- `src/components/sponsor-form.tsx`
- `src/components/registration-form.tsx`
- `src/components/profile-form.tsx`
- `src/components/memorial-form.tsx`
- `src/components/site-mode-toggle.tsx`
- `src/components/site-nav.tsx`
- `src/app/[slug]/layout.tsx`
- `src/app/[slug]/sponsor/page.tsx`
- `src/app/[slug]/sponsor/confirmation/page.tsx`
- `src/app/[slug]/sponsors/page.tsx`
- `src/app/[slug]/schedule/page.tsx`
- `src/app/[slug]/profile/[token]/page.tsx`
- `src/app/[slug]/yearbook/page.tsx`
- `src/app/[slug]/yearbook/[profileId]/page.tsx`
- `src/app/[slug]/yearbook/print/page.tsx`
- `src/app/[slug]/memorial/page.tsx`
- `src/app/[slug]/memorial/submit/page.tsx`
- `src/app/[slug]/memorial/review/[token]/page.tsx`
- `src/app/api/interest/route.ts`

- `src/app/api/sponsor-checkout/route.ts`
- `src/app/api/register/route.ts`
- `src/app/api/profile/route.ts`
- ~~`src/app/api/profile/resend/route.ts`~~ (removed — token recovery is admin-only)

- `src/lib/upload.ts` (shared upload helper)
- `src/lib/site-mode.ts` (siteMode enforcement helper)
- `src/app/api/memorial/route.ts`
- `src/app/api/memorial/review/route.ts`
- `src/app/api/admin/site-mode/route.ts`
- `src/app/api/admin/sponsors/route.ts`
- `src/app/api/admin/memorial/route.ts`
- `src/app/api/admin/profiles/route.ts`

---

## Success Criteria

1. Tease mode: visitors see engaging teaser with interest capture + sponsor CTA; full site hidden
2. Admin can switch site mode (tease → pre_register → open) from admin panel
3. Sponsors can pay via Stripe, upload logos; approved sponsors display on sponsor wall
4. Registration collects event preferences; Saturday banquet offers early-bird vs standard pricing
5. After registration, users get an edit token link to fill out yearbook profile
6. Published profiles browsable on yearbook page; print-friendly view generates clean PDF via browser
7. Memorial submissions go through: submit → admin draft → submitter review → publish
8. Admin panel shows all data across tabs with appropriate controls
9. All existing functionality continues to work
10. Zero new hosting costs

---

## Risk Areas

1. **Schema migration on live data**: New columns on `reunions` have defaults, new tables are additive. Safe, but back up Turso before pushing.
2. **Stripe webhook disambiguation**: Two payment types (RSVP + sponsor) sharing one webhook. Use distinct metadata keys (`rsvp_id` vs `sponsor_id`) and check explicitly.
3. **Vercel Blob free tier (250MB)**: ~300 classmates with photos + sponsor logos should be well under. Monitor usage.
4. **Vercel serverless timeout (10s free tier)**: Print-friendly yearbook page loads all profiles — paginate or lazy-load images if slow.
5. **Edit token leakage**: Token appears on the confirmation page post-registration and in profile edit URLs. Low risk (unguessable UUID, shown only to the registrant). Token recovery is admin-only in v1.
6. **Memorial sensitivity**: Auto-publishing disabled by design. Admin must review everything. Review link is a UUID — safe to share.

---

## Verification

1. `npm run build` — confirms no TypeScript errors
2. `npm run dev` — test all flows locally:
   - Tease mode: interest signup works, sponsor CTA links to sponsor page
   - Sponsor flow: form → Stripe checkout → confirmation → admin approves → appears on sponsor wall
   - Switch site mode to open → registration flow works with event selection
   - Pay now vs pay later paths both work
   - Profile edit via token link → yearbook page shows profile
   - Memorial submit → admin edits → review link → approve → published
3. Admin panel: verify all tabs show data, toggles work
4. `drizzle-kit push` against test DB before production

---

## Audit Findings (Self-Audit)

These findings shaped the plan above:

- **[FIXED] Task atomicity**: Original plan had compound tasks ("create form and API route"). Split into separate tasks.
- **[FIXED] Profile data duplication**: Originally had name/email on both `profiles` and `rsvps`. Fixed: `profiles` references `rsvpId` and uses rsvp's name/email via join.
- **[FIXED] Memorial email assumption**: Original workflow assumed email sending. Fixed: v1 admin copies review link manually; email integration is a future phase.
- **[FIXED] Interest signup dedup**: Added upsert behavior to prevent duplicate signups from same email.
- **[WARNING] No email in v1**: Several flows benefit from email (profile edit link, memorial review link, interest-to-registration conversion). All handled via manual admin action or on-screen display for v1. Email integration should be Phase 2.
- **[WARNING] `registrationOpen` migration**: Keeping old boolean alongside new `siteMode` for backward compat. Must update all reads to use `siteMode`. Old column can be dropped in a future cleanup.
- **[NIT] Print page performance**: For 300+ profiles with images, the print page could be slow. Acceptable for v1; optimize if needed.

### Convergence Audit Fixes (Iteration 1)
- **[FIXED] Edit token on profiles table removed** — token lives only on `rsvps` to avoid two sources of truth (was 0.6 + 0.9 conflict)
- **[FIXED] Profile resend endpoint removed** — public `/api/profile/resend` exposed edit tokens via email enumeration; recovery is now admin-only (4.6)
- **[FIXED] Pay-later vs abandoned checkout ambiguity** — added `paymentMethod` column (`online` | `door`) to `rsvps` so admin can distinguish intentional pay-later from abandoned checkouts (0.9, 3.4)
- **[FIXED] Interest signup index → unique constraint** — `(reunionId, email)` must be UNIQUE for upsert to work in SQLite (0.3)
- **[FIXED] Junction table unique constraints** — added unique on `(interestSignupId, eventId)` and `(rsvpId, eventId)` to prevent duplicate rows (0.4, 0.8)
- **[FIXED] Memorial adminDraft → JSON text** — stores all publishable fields as structured JSON; added `reviewNotes` and `reviewedAt` fields for submitter feedback (0.7)
- **[FIXED] Sponsor webhook expiry handling** — plan now specifies handling `checkout.session.expired` for sponsors too (2.6)
- **[FIXED] Sponsor tier threshold defined** — Top Sponsor >= $500, Community Service < $500; stored as codebase constant (Key Decisions table)

### Residual Risk
- No automated email means admin has manual work for memorial reviews and profile link distribution. This is acceptable for a small reunion but won't scale to multi-tenant without email.
- Early-bird pricing requires a clear deadline to be set in the events table. If not set, defaults to standard pricing. Admin must configure this.
