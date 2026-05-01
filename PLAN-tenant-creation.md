# PLAN: Tenant Creation + Generic Demo Seed

## Context Gathered (Step 1)

### Tech stack
Next.js 16 (App Router), React 19, Drizzle ORM + Turso (libsql/SQLite),
Stripe Connect (Express, destination charges), Vercel Blob, Tailwind 4. Drizzle
migrations applied via `drizzle-kit push`. Vercel hosting (`phhs1996` project).

### Tenant model today
- **Tenant = `reunions` row.** Slug-routed at `/[slug]/*` and `/admin/[slug]/*`.
  No middleware tenancy — pure App Router dynamic params.
- Every tenant-scoped table carries a `reunionId` FK (rsvps, events,
  registrationEvents, interestSignups, eventInterests, sponsors, profiles via
  rsvpId, memorials, contactMessages). **No FK CASCADE anywhere** — deleting a
  reunion would fail.
- Per-tenant Stripe Connect: 4 columns on `reunions` (account id +
  onboardingComplete + chargesEnabled + payoutsEnabled). Webhooks resolve
  reunion via `stripeConnectedAccountId`.
- Per-tenant `siteMode` (tease/pre_register/open) and `registrationFeeCents`.
- `reunions.isActive` exists; root `/` redirects to first active reunion.
- The codebase already has a **test-tenant pattern** (`phhs-1996-test`,
  `wipeTestTenant`, `createBareTestReunion`, `loadProdShell`). It's exactly the
  shape of building blocks tenant-creation needs — they need to stop assuming
  PHHS is the reference shell.

### Auth model (current — origin/staging tip `8281594`)
Clerk + two-tier roles, both DB-backed:
- **Super admin:** rows in `super_admins` table. Bootstrap row inserted via
  `npm run db:seed-super-admins`. New super admins are added via the admin UI
  (only an existing super admin can invite another). Server-side guards: a
  super admin cannot remove themselves and cannot remove the last super admin.
- **Reunion admin:** rows in `reunion_admins` table linking email →
  reunionId. Same email may admin multiple reunions via separate rows.
- API guards: `requireSuperAdmin / requireReunionAdmin(id) / requireAnyAdmin`
  (return `NextResponse` on fail). Page guards: same with `Page` suffix
  (redirect to `/admin/forbidden` or sign-in on fail).
- `src/proxy.ts` (Next 16 name; replaces `middleware.ts`) gates
  `/admin(.*)` and `/api/admin(.*)` for signed-in status. Role enforcement
  lives in the helpers, not the proxy.
- Super-admin pages at `/admin/super` (reunion list with admin counts) and
  `/admin/super/admins` (combined CRUD for both super admins and per-reunion
  admins). API: `/api/admin/super/admins` (reunion admins) and
  `/api/admin/super/super-admins` (super admins).
- Seed scripts: `db:seed-admins`, `db:seed-super-admins`.
- `isSuperAdmin(email)` is now async (DB lookup with try/catch fail-closed).

### Demo seed pattern today
- `seed.ts` creates the PHHS reunion + 4 events directly (PHHS-baked).
- `canonical-events.ts` defines four PHHS events with PHHS copy.
- `seed-events.ts` is an idempotent upsert + prune for canonical events
  against `phhs-1996`. PHHS slug hardcoded.
- `seed-test.ts` creates `phhs-1996-test` mirroring prod shell + 10 sample
  RSVPs, 7 profiles, 3 sponsors, 1 memorial, 5 interest signups. Names are
  realistic but plausibly neutral (Sarah Mitchell, Mike Johnson, Jennifer
  Park…). Some sample copy references Trojans / Park Hill.
- `wipe-test.ts` resets test tenant to a bare empty reunion.

### Hardcoded PHHS-isms found
| Where | What |
|---|---|
| `src/lib/db/schema.ts:277` | `profiles.favoritePHMemory` column name |
| `src/app/layout.tsx:16-18` | metadata title/description (PHHS Class of 1996 — 30 Year Reunion) |
| `src/app/[slug]/page.tsx` | "30 Year Reunion" subtitle, "August 28-29, 2026" hardcoded date card, "Friday & Saturday" string, "Saturday Banquet" label, **96 Backpacks block with "Park Hill students" + "Replenish KC"**, red-700/red-900 theme baked across hero |
| `src/app/[slug]/community-service/page.tsx:7,40,48,54-55` | `PROJECT_NAME = "96 Backpacks"`, "Park Hill community", "Park Hill students", "Replenish KC", "Park Hill schools" |
| `src/app/[slug]/sponsor/page.tsx:48,66-67` | "Trojan Sponsor" heading, "Funds the 96 Backpacks community service project — giving back to Park Hill schools" |
| `src/app/[slug]/sponsors/page.tsx:71,75` | "Trojan Sponsors" section title and comment |
| `src/app/[slug]/yearbook/[profileId]/page.tsx:45` | "Favorite Park Hill Memory" label + reads `profile.favoritePHMemory` |
| `src/app/[slug]/confirmation/page.tsx:83,90` | "You're All Set, Trojan!", "PHHS Class of '96 reunion has been confirmed" |
| `src/app/api/sponsor-checkout/route.ts:87-88` | Stripe Checkout `product_data.name` "Trojan" / "Community Service Project" + description "PHHS Class of 1996 Reunion Sponsorship" |
| `src/components/profile-form.tsx:167` | "Favorite Park Hill Memory" form label |
| `src/components/site-nav.tsx:51` | "PHHS '96" header brand |
| `src/lib/constants.ts:9-11` | `getSponsorTierLabel("top")` returns hardcoded "Trojan" |
| `src/lib/db/canonical-events.ts` | All four event copies reference Park Hill, Trojans, KC, Replenish KC, 96 backpacks |
| `src/lib/db/seed.ts` + `seed-test.ts` + `test-tenant.ts` | PHHS slugs, PHHS shell defaults, sample data references "Trojans" |
| Across `[slug]/*` and admin | red-* Tailwind classes (`bg-red-700`, `from-red-700`, `text-red-700`, `border-red-200`, …) baked as the brand color |

### What's NOT hardcoded (good news)
- All tenant data is keyed via `reunionId`. Schema is already
  multi-tenant-safe at the row level.
- Stripe Connect onboarding is already per-tenant.
- Slug routing is already per-tenant.
- Sponsor tier threshold + display rules + memorial workflow + interest
  capture + edit-token model — all per-tenant via `reunionId`.

### Worktree base — current
Branch `tenant-creation` is now rebased onto `origin/staging` tip `8281594`,
which contains both the clerk-auth merge (`c8aafbf`) and the super-admins
DB-table migration (`8281594`). `npm install` has run cleanly; `npx tsc
--noEmit` is clean. Phase 0.1 + 0.2 are complete. Implementation can proceed
directly into Phase 1.

---

## Open Decisions (for Ryan to make before / during execution)

These are pre-decided neither in this plan nor in code. Surface them up front
because they shape Phase 1+ choices.

| # | Decision | Why it matters | Default if undecided |
|---|----------|---------------|----------------------|
| **D1** | **Tenant config breadth.** Minimum: school name, class year, mascot, brand color, logo. Bigger: copy overrides for hero/footer, tier labels, custom field labels. | Drives schema columns and admin UI surface area in Phase 1. | Minimum set (5 fields) for v1; expand later. |
| **D2** | **Routing.** Stay path-based `/{slug}/...` for v1, or also do subdomain `{slug}.domain.com` / custom domain? | Subdomain/custom domain requires DNS + Vercel project config + cookie scope rethink — not trivial. | Path-based only for v1. Custom-domain hook noted but deferred. |
| **D3** | **Demo seed trigger.** Auto-seed on tenant create? Or "blank vs demo" choice in the create form? Or admin can re-seed/wipe-and-reseed any time? | Affects API design. | "Blank vs demo" radio at create time; admin can re-run demo seed against an empty tenant from settings. |
| **D4** | **Demo seed flavor.** Pure placeholder ("Sample High", "20XX") vs realistic-looking generic ("Riverside High School Class of 2010" with sample alumni). | Drives copy of every demo page. | Realistic-looking generic — buyers evaluating the platform see something live-looking, not lorem ipsum. |
| **D5** | **`favoritePHMemory` column.** Rename to `favoriteSchoolMemory` (DB-level rename) or alias-only (keep column, surface a tenant-configurable label)? | Rename = one-shot migration risk. Alias = no schema risk but column name confuses readers forever. | Rename via copy-then-drop in two deploys (Phase 3). |
| **D6** | **Color theme.** Replace baked red with a CSS-variable-driven per-tenant theme now, or accept red-default for v1 and theme later? | Per-tenant theming touches many files; meaningful refactor. | Make `--brand-primary` and `--brand-primary-dark` CSS vars driven from tenant config; default both to current red shades so PHHS is unchanged. Tailwind classes that hardcode red stay red unless touched in Phase 3. |
| **D7** | **Tenant lifecycle: deactivate vs delete.** Soft-delete via `isActive=false` (already the column we have) vs cascade-delete with `ON DELETE CASCADE` migration? | Hard delete = data loss + Stripe Connect orphans. | Soft delete (`isActive=false`) for v1. Public slug routing 404s for non-admins when `!isActive`; admins still reach the slug for recovery (gate added in Phase 3B.5). Hard-delete via super-admin "purge" command is a follow-up. |
| **D8** | **Root `/` page.** Currently redirects to first active reunion. With N tenants, options: (a) marketing landing, (b) reunion directory, (c) keep first-active redirect. | UX call. | (a) Static marketing landing — but explicitly out of scope for this plan; leave the current redirect behavior in place and add a TODO comment. |
| **D9** | **`registration_open` legacy column.** Already legacy per schema comment. Drop now while we're touching this area, or keep? | Dropping requires schema migration + sweep of any remaining reads. | Defer — not on the critical path. |
| **D10** | **Migration of existing PHHS tenant.** Programmatic backfill of new tenant-config columns from PHHS values (a one-shot script) so the live site renders identically post-deploy. | Without backfill, hero card, sponsor page, community service block, confirmation page, etc. all degrade for the live PHHS tenant on first deploy. | One-off script `npm run db:backfill-phhs-config` runs once, populates the new config columns with the current PHHS-specific copy, and is then archived. |

---

## Conductor Plan

### Objective
Lift the codebase from "PHHS reunion app that happens to support multiple
reunions in the schema" to "multi-tenant reunion platform" — super admin can
create a fresh tenant, optionally seed it with a generic demo dataset, and
the existing PHHS tenant continues to render identically.

### Scope (in)
- Pre-flight: clerk-auth merged into origin/staging (Phase 0)
- Per-tenant **identity/branding config columns** on `reunions` (Phase 1)
- **Generic demo seed dataset** + reusable seed function (Phase 2)
- **De-PHHS-ify** everything user-visible — replace baked strings/colors with
  tenant config or generic copy; rename `favoritePHMemory` (Phase 3)
- **Super-admin "Create Tenant" UI + API** + slug validation + first
  reunion-admin assignment (Phase 4)
- **Tenant settings UI** (edit identity/branding, deactivate) (Phase 5)
- **Existing-tenant migration**: backfill PHHS config columns so the live
  reunion looks identical (Phase 6)
- Tests + rollout plan (Phase 7)

### Scope (out)
- Subdomain / custom domain routing — D2 deferred
- Marketing root page — D8 deferred
- Hard tenant delete with cascade — D7 deferred
- Drop `registration_open` legacy column — D9 deferred
- Email notifications for tenant invites (super admin shares the URL out of band — same model as today)
- New billing/SaaS model (no platform subscription fee yet)
- Theme-system overhaul (D6 — minimal CSS-vars only; Tailwind class sweep
  is bounded to a known list, not exhaustive)

### Files Affected

**Modify:**
- `src/lib/db/schema.ts` — add tenant-config columns to `reunions`; rename
  `profiles.favoritePHMemory` → `favoriteSchoolMemory`
- `src/lib/constants.ts` — `getSponsorTierLabel` becomes per-tenant aware;
  add `DEFAULT_TENANT_CONFIG` for column defaults
- `src/lib/db/canonical-events.ts` — split into PHHS-specific
  (`canonical-events-phhs.ts`, used only by backfill) + generic demo events
  (`canonical-events-demo.ts`)
- `src/lib/db/seed.ts` — rewrite to seed any tenant via param; PHHS-specific
  call moves into a backfill script
- `src/lib/db/seed-events.ts` — generalize: takes `REUNION_SLUG` env var (or
  argv), uses a passed canonical-events array
- `src/lib/db/seed-test.ts` — generalize so any tenant can be reseeded with
  the demo dataset; keep `phhs-1996-test` slug for backward compat
- `src/lib/db/test-tenant.ts` — `loadProdShell` becomes generic
  `loadDemoShell` returning a generic shell (no PHHS fallback). Drop
  `PROD_REUNION_SLUG`.
- `src/lib/db/wipe-test.ts` — generalize via slug param; document the
  sequence
- `src/app/layout.tsx` — root metadata becomes generic platform branding
  (D8 default)
- `src/app/page.tsx` — keep first-active redirect; add TODO comment for D8
- `src/app/[slug]/page.tsx` — replace 30-year subtitle, August date card,
  Saturday Banquet label, 96-Backpacks block, red theme with tenant-config
  reads
- `src/app/[slug]/community-service/page.tsx` — render only when tenant has
  configured a community-service project; otherwise 404
- `src/app/[slug]/sponsor/page.tsx`, `sponsors/page.tsx` — sponsor tier
  labels and recognition copy come from tenant config
- `src/app/[slug]/confirmation/page.tsx` — drop "Trojan!", drop "PHHS Class
  of '96", read tenant config for friendly name + reunion noun
- `src/app/[slug]/yearbook/[profileId]/page.tsx` — "Favorite Park Hill
  Memory" → tenant-config label + new column name
- `src/app/api/sponsor-checkout/route.ts` — Stripe `product_data.name` and
  `description` derived from tenant config
- `src/components/profile-form.tsx` — same "Favorite Park Hill Memory" fix
- `src/components/site-nav.tsx` — drop "PHHS '96", use `tenant.shortName`
- `src/app/admin/page.tsx` — multi-reunion picker (already exists in
  clerk-auth) gains a "Create new reunion" entry-point for super admins
- `src/app/admin/super/page.tsx` — adds a "Create new reunion" button at top
- `src/app/admin/[slug]/page.tsx` — adds "Settings" tab/link to new tenant
  settings page
- `.env.example` — document new env vars (none required, but add comment for
  per-tenant Amazon Wish List override migration)
- `package.json` scripts — add `db:seed-demo`, `db:backfill-phhs-config`

**Create:**
- `src/lib/db/canonical-events-phhs.ts` — frozen copy of today's
  canonical-events (used only by Phase 6 backfill)
- `src/lib/db/canonical-events-demo.ts` — generic demo events (D4)
- `src/lib/db/seed-demo.ts` — reusable function `seedDemoTenant(db,
  reunionId)` that lays down generic events + sample RSVPs/profiles/
  sponsors/memorials/interests for any reunion id
- `src/lib/db/backfill-phhs-config.ts` — one-off: populates new tenant-config
  columns on the existing `phhs-1996` reunion with current copy
- `src/lib/tenant-slug.ts` — `validateSlug(slug): { ok: boolean; reason?: string }`. Reserved-word list (admin, api, sign-in, etc.) + format rules
- `src/lib/tenant-config.ts` — typed reader: `getTenantConfig(reunion: Reunion): TenantConfig` with all branding/copy fields and defaults
- `src/app/admin/super/new-reunion/page.tsx` — server-rendered create form
- `src/app/admin/super/new-reunion/create-reunion-client.tsx` — client island for the form (live slug validation, "with demo data" toggle)
- `src/app/api/admin/super/reunions/route.ts` — POST handler: super-admin guard, validates slug, inserts reunion row, optional `seedDemoTenant`, optional `reunion_admins` row for the first admin email, returns the new slug
- `src/app/admin/[slug]/settings/page.tsx` — tenant settings UI: edit identity/branding, toggle `isActive`
- `src/app/admin/[slug]/settings/settings-client.tsx` — client island for the form
- `src/app/api/admin/reunion/[id]/route.ts` — PATCH handler: reunion-admin guard, updates tenant-config columns
- `src/components/tenant-brand-style.tsx` — server component that emits the per-tenant CSS variables (`--brand-primary`, `--brand-primary-dark`) on `[slug]/layout.tsx`

### Micro-Tasks (atomic, sequential)

#### Phase 0 — Pre-flight (DONE)

| # | Task | Status |
|---|------|--------|
| 0.1 | clerk-auth foundation on `origin/staging` | ✅ pushed by Ryan's other agent |
| 0.2 | Rebase `tenant-creation` onto `origin/staging` tip `8281594`, `npm install`, `tsc --noEmit` | ✅ clean fast-forward, deps installed, typecheck clean |
| 0.3 | Resolve open decisions D1–D10 | proceeding with documented defaults; Ryan to course-correct as needed |

**Note on super-admin model:** since the original plan was drafted, super
admins moved from env var to a `super_admins` DB table (commit `8281594`).
All Phase 4–5 references to "super-admin guard" still work via
`requireSuperAdmin()` / `requireSuperAdminPage()` — the helper signatures
are unchanged; only `isSuperAdmin` became async internally. No plan tasks
need to change as a result.

#### Phase 1 — Tenant config schema

| # | Task | Agent |
|---|------|-------|
| 1.1 | In `src/lib/db/schema.ts`, add nullable text columns to `reunions`: `orgName` (e.g., "Riverside High School"), `orgShortName` (e.g., "Riverside"), `mascot` (e.g., "Tigers"), `classYear` (text — kept text not int because some reunions are multi-class), `reunionMilestoneLabel` (e.g., "30 Year Reunion" — derivable but stored to allow override), `banquetLabel` (e.g., "Saturday Banquet"; default "Banquet" when null), `brandColorPrimary` (hex like `#b91c1c`), `brandColorPrimaryDark` (hex like `#7f1d1d`), `logoUrl`, `communityServiceProjectName` (nullable; null hides the page), `communityServiceCharityName`, `communityServiceTeaserCopy` (short, ≤240 chars, used on home-page block), `communityServiceFullCopy` (markdown-safe; rendered on `/community-service`), `sponsorTopTierLabel` (default "Top"), `sponsorCommunityTierLabel` (default "Community"), `favoriteMemoryLabel` (default "Favorite School Memory"). All nullable; later phases backfill PHHS values. **Two community-service copy fields, not one** — the home-page block needs a one-sentence teaser; the dedicated page needs the full multi-paragraph version. Single-column with truncation rules was the v1 attempt; rejected during convergence audit because faithful PHHS rendering needs both lengths. | Code |
| 1.2 | Run `drizzle-kit push` against staging DB. Verify columns added without table rebuild. | Audit |
| 1.3 | Add `src/lib/tenant-config.ts` exporting `TenantConfig` type (one field per column above plus `slug`, `name`, `eventDate` etc.) and `getTenantConfig(reunion: Reunion): TenantConfig` that reads each column with a generic-default fallback (e.g., `orgName ?? reunion.name`, `brandColorPrimary ?? "#b91c1c"`). Centralizes the "what to fall back to" logic so callers don't sprinkle `??` everywhere. | Code |
| 1.4 | Add `src/components/tenant-brand-style.tsx` — server component that renders a `<style>` tag injecting `--brand-primary` and `--brand-primary-dark` CSS variables from `getTenantConfig(reunion)`. Used by `[slug]/layout.tsx` (Phase 3 wires it up). | Code |
| 1.5 | Add `src/lib/tenant-slug.ts` exporting `validateSlug(s)`. Rules: lowercase letters/digits/hyphens, 3–40 chars, no leading/trailing hyphen, not in `RESERVED_SLUGS = ["admin","api","sign-in","sign-up","_next","favicon","robots","sitemap","forbidden","super","new-reunion","settings"]`. Returns `{ ok: true } \| { ok: false; reason: string }`. Pure function — DB uniqueness checked separately. | Code |

**Success:** All new columns present, type-safe access via
`getTenantConfig`, slug validator covers reserved words.

#### Phase 2 — Generic demo seed dataset (D3, D4)

| # | Task | Agent |
|---|------|-------|
| 2.1 | Create `src/lib/db/canonical-events-phhs.ts` — verbatim copy of today's `canonical-events.ts` (PHHS copy). Used only by the Phase 6 backfill. | Code |
| 2.2 | Create `src/lib/db/canonical-events-demo.ts` — four generic-but-plausible demo events for "Riverside High School Class of 2010, 15-Year Reunion": Friday tailgate, Friday casual gathering at a local venue, Saturday community service (configurable, default "School Supply Drive"), Saturday evening banquet. Use realistic but obviously-not-real names ("Riverside Tigers", "Saturday Banquet at The Lakeside Club"). Match the existing `CanonicalEvent` shape; honor the null-only contract for unfinalized fields. | UX + Code |
| 2.3 | Refactor `src/lib/db/canonical-events.ts` to re-export from the right place. Either (a) deprecate the old file and update `seed-events.ts` / `seed-test.ts` callers to import from the new files explicitly, or (b) keep `canonical-events.ts` as a thin re-export that points at the demo set as the new default. Choose (a) — explicit imports make the PHHS coupling visible. Update `seed-events.ts` to import from `canonical-events-phhs.ts` (until Phase 6 retires it). | Code |
| 2.4 | Create `src/lib/db/seed-demo.ts` exporting `async function seedDemoTenant(db, reunionId): Promise<{ events, rsvps, sponsors, memorial, interests }>`. **Reads the reunion row** at the start (one `select … where id = reunionId`) and anchors all seeded event timestamps to `reunion.eventDate`. If `reunion.eventDate` is null, throw `ReunionMissingEventDateError(reunionId)` — the create flow (4.1) collects eventDate as required, so this should be unreachable in practice but is a safety net. (No `opts.eventDate` parameter — single source of truth is the stored row, so callers can't desync the homepage from the seeded events.) Pre-flight emptiness check **must enumerate every tenant-scoped table** so partial state can't slip through: `events`, `rsvps`, `profiles` (via rsvp join), `sponsors`, `memorials`, `interestSignups`, `eventInterests` (via interestSignup join), `registrationEvents` (via rsvp join), `contactMessages`. If a `count(*) > 0` for any of those rows scoped by `reunionId`, throw `TenantNotEmptyError(tableName, count)` and refuse. **Backfill demo CS config** if missing on the reunion: when any of `communityServiceProjectName`, `communityServiceTeaserCopy`, `communityServiceFullCopy` are null, set them to demo defaults (e.g., "School Supply Drive" / teaser / full paragraphs) inside the same transaction so the home-page CS block + `/community-service` page line up with the seeded community-service event. Without this, a demo tenant ends up internally inconsistent: a Saturday CS event in the schedule but a hidden homepage block and a 404 on `/community-service`. Then lays down: 4 demo events (from `canonical-events-demo.ts`, retargeted to the passed reunionId, datetimes computed from `reunion.eventDate`), 10 sample RSVPs with 4 paid + 6 mixed, 7 published profiles, 3 sponsors (1 top, 2 community), 1 memorial (status "published"), 5 interest signups. Sample copy uses the demo school context, not Park Hill / Trojans. The whole seed (config backfill + data) runs in a single Drizzle transaction so a mid-seed failure leaves zero rows. | Code + UX |
| 2.5 | Add `db:seed-demo` script to `package.json`: `npx tsx --env-file=.env.local src/lib/db/seed-demo-cli.ts`. Create `seed-demo-cli.ts` that reads `REUNION_SLUG` env var, looks up the reunion, and calls `seedDemoTenant`. | Code |
| 2.6 | Update `src/lib/db/seed-test.ts` to call `seedDemoTenant` against the test slug, retiring the inline sample-data arrays. The `phhs-1996-test` slug stays for backward compat with bookmarks/scripts; data laid down is now generic demo (this is fine — the test tenant is for testing). Update `loadProdShell` → rename to `loadDemoShell`, drop the PHHS fallback (return the generic shell unconditionally). Update `seed-test.ts` and `wipe-test.ts` callers. | Code |
| 2.7 | Run `npm run db:wipe-test && npm run db:seed-test` against a local DB; verify the test tenant renders end-to-end with generic copy, sample data is visible, no PHHS strings on screen. | Audit |

**Success:** `seedDemoTenant(db, reunionId)` lays down a complete demo
dataset for any reunion. `phhs-1996-test` becomes a generic-demo tenant. PHHS
content is now isolated to `canonical-events-phhs.ts` + the live
`phhs-1996` row.

#### Phase 3 — De-PHHS-ify user-visible code

| # | Task | Agent |
|---|------|-------|
| 3.1 | Add `favoriteSchoolMemory` text column to `profiles` in `schema.ts`. Keep `favoritePHMemory` for now (column-rename via copy-then-drop pattern: this phase writes to the new column; Phase 6 backfill copies old → new; a follow-up plan drops the old column once verified). | Code |
| 3.2 | `drizzle-kit push` to apply. Verify both columns coexist. | Audit |
| 3.3 | Update `src/components/profile-form.tsx`: write input now goes to `favoriteSchoolMemory`; label reads `tenantConfig.favoriteMemoryLabel`. On read, fall back to `favoritePHMemory` if new column is null (for in-flight migrations). | Code |
| 3.4 | Update `src/app/api/profile/route.ts` to write `favoriteSchoolMemory` (not `favoritePHMemory`). | Code |
| 3.5 | Update `src/app/[slug]/yearbook/[profileId]/page.tsx`: label from `tenantConfig.favoriteMemoryLabel`; value reads `profile.favoriteSchoolMemory ?? profile.favoritePHMemory`. | Code |
| 3.6 | Update `src/app/[slug]/page.tsx` hero: replace hardcoded "30 Year Reunion" with `tenantConfig.reunionMilestoneLabel`. Replace "August 28-29, 2026" detail card with derived from `reunion.eventDate` formatting. Replace "Friday & Saturday" with computed weekdays from `eventDate`. Replace "Saturday Banquet" label with `tenantConfig.banquetLabel ?? "Banquet"`. Replace 96-Backpacks block: render only when `tenantConfig.communityServiceProjectName` is non-null; copy from `tenantConfig.communityServiceTeaserCopy` (plain text — strip HTML, preserve line breaks). Hero gradient classes stay red **for now**; CSS-vars-driven theming is task 3.10. | Code + UX |
| 3.7 | Update `src/app/[slug]/community-service/page.tsx`: if `tenantConfig.communityServiceProjectName` is null, return `notFound()`. Otherwise: read project name, charity name, and `communityServiceFullCopy` from tenant config. Move the existing PHHS copy out and into the Phase 6 backfill (so the existing PHHS tenant continues to show the same content). | Code + UX |
| 3.8 | Update `src/app/[slug]/sponsor/page.tsx`, `sponsors/page.tsx`, and the admin badge in `src/app/admin/[slug]/admin-tabs.tsx`: tier labels come from `tenantConfig.sponsorTopTierLabel` / `sponsorCommunityTierLabel`. Recognition copy on the sponsor page references the tenant's school/org. Defaults (when null): "Top Sponsor" / "Community Sponsor". | Code + UX |
| 3.9 | Update `src/app/api/sponsor-checkout/route.ts`: Stripe `product_data.name` uses tenant tier labels (with defaults); `description` is `${tenant.orgName} ${tenant.reunionMilestoneLabel} sponsorship` (or generic fallback). | Code |
| 3.10 | Update `src/app/[slug]/layout.tsx` to render `<TenantBrandStyle reunion={reunion} />` once at the top, defining `--brand-primary` and `--brand-primary-dark`. **Bounded sweep:** in `src/app/[slug]/page.tsx`, `confirmation/page.tsx`, `sponsor/page.tsx`, `sponsors/page.tsx`, `community-service/page.tsx`, and `src/components/site-nav.tsx`, replace the highest-traffic baked red classes with CSS-var classes (`bg-[color:var(--brand-primary)]` etc.). Out of scope: full Tailwind class sweep across every component — that's a follow-up. PHHS backfill in Phase 6 sets `--brand-primary = #b91c1c` (current red-700) and `--brand-primary-dark = #7f1d1d` so the live site is unchanged. | Code + UX |
| 3.11 | Update `src/app/[slug]/confirmation/page.tsx`: drop "You're All Set, Trojan!" — replace with "You're All Set!" (no mascot reference) or `${tenantConfig.mascot ? tenantConfig.mascot + "!" : ""}` if Ryan wants the mascot reference back (D1 sub-decision). Drop hardcoded "PHHS Class of '96 reunion" — read `${tenantConfig.orgName} ${tenantConfig.reunionMilestoneLabel}` (with safe defaults). | Code + UX |
| 3.12 | Update `src/components/site-nav.tsx`: header label uses `tenantConfig.orgShortName ?? reunion.name`. | Code |
| 3.13 | Update `src/app/layout.tsx` root metadata to platform-generic ("Reunion Platform" or similar) — root `/` is not a tenant page. Per-tenant metadata stays at `[slug]/layout.tsx` (already dynamic in Susy plan; if not, add it here). | Code |
| 3.14 | Audit pass — grep `src/` for remaining "Park Hill", "PHHS", "Trojan", "Class of 1996", "96 Backpacks", "Replenish", "Olde Mill", "Kelly Barges", "favorite ph memory" (case-insensitive). Acceptable remaining hits: `canonical-events-phhs.ts`, `backfill-phhs-config.ts`, this PLAN doc, archived plan docs. Any new hits → fix or document why. | Audit |
| 3.15 | Manual QA on the test tenant (which is now generic): visit `/{TEST_SLUG}/`, `/sponsor`, `/sponsors`, `/community-service`, `/yearbook`, `/confirmation` after a test rsvp. The test tenant is seeded by `seedDemoTenant` (Phase 2.6), which since iteration 5 backfills demo CS config — so `/community-service` should **render** with the demo project ("School Supply Drive") + teaser/full copy, **not 404**. The 404 expectation only applies to a tenant explicitly created blank (Phase 4 "without demo data" path); cover that case in 4.6 instead. Confirm zero PHHS strings on screen. | Audit |

**Success:** Generic-tenant rendering is fully PHHS-free and driven by tenant
config columns. PHHS content is gone from every user-facing component.

#### Phase 3B — Cross-tenant query scoping (security gate before multi-tenancy)

**Context.** Today every tenant-scoped row carries `reunionId`, but several reads in
`[slug]/*` pages and the admin dashboard do not actually filter on it. With one tenant
that is invisible; the moment a second tenant exists it becomes a cross-tenant data
leak. The audit (`/converge` Iteration 1) found at least four offenders. Treat this
phase as a hard gate: until every public and admin read is reunion-scoped,
**Phase 4 (CreateTenant) must not ship** — creating a second tenant before this is
fixed would expose PHHS data on the new tenant's URLs.

**Schema note** (matters for the helper design): `profiles`, `registrationEvents`, and `eventInterests` do **not** carry a direct `reunionId` column. They reach the reunion through a join: `profiles → rsvps.reunionId`, `registrationEvents → rsvps.reunionId`, `eventInterests → interestSignups.reunionId`. Direct-FK tables (carry `reunionId` themselves): `rsvps`, `events`, `sponsors`, `memorials`, `interestSignups`, `contactMessages`. Phase 3B's helpers and refactors must respect both shapes — a single `where(eq(table.reunionId, ...))` won't fit the join-scoped tables.

| # | Task | Agent |
|---|------|-------|
| 3B.1 | Sweep every file under `src/app/[slug]/**` for `db.select().from(<tenantTable>)` and verify each call either has a `where(eq(<table>.reunionId, reunion.id))` clause (direct-FK tables) or filters via the joined parent's `reunionId` (join-scoped tables: profiles via rsvps, registrationEvents via rsvps, eventInterests via interestSignups). Confirmed offenders to fix in this phase: (a) `src/app/[slug]/yearbook/page.tsx:28-36` — profile list joins profiles→rsvps but doesn't filter `rsvps.reunionId`; (b) `src/app/[slug]/yearbook/[profileId]/page.tsx:25-29` — profile detail looks up by id; must verify the profile's rsvp's reunionId matches; (c) `src/app/[slug]/yearbook/print/page.tsx:26` — same as list; (d) `src/app/[slug]/confirmation/page.tsx:36-41` — looks up rsvp by id from a Stripe session; must verify `rsvp.reunionId === reunion.id` after the lookup; (e) `src/app/[slug]/sponsor/confirmation/page.tsx:24` — same pattern, sponsor lookup by id from session/token; (f) `src/app/[slug]/memorial/review/[token]/page.tsx:14` — memorial lookup by token; even though tokens are unguessable, the slug→reunion match should still be verified to keep cross-tenant URLs honest. | Code + Audit |
| 3B.2 | Same sweep for `src/app/admin/[slug]/**`. Confirmed offender: `src/app/admin/[slug]/page.tsx:74-83` — profiles join with rsvps, no reunion filter — admin viewing reunion A would see profiles from B. Fix by adding `.where(eq(rsvps.reunionId, reunion.id))` after the inner join. | Code + Audit |
| 3B.3 | Same sweep for `src/app/api/**` mutation routes (POST/PATCH/DELETE). For each handler, verify any "fetch row by id" lookup also confirms that row's `reunionId` (or its joined parent's `reunionId`) matches the request's intended reunion. Common pattern: a POST route that does `db.select().from(<table>).where(eq(<table>.id, body.id))` then mutates — that's a cross-tenant write hole. Either resolve the reunion from the slug/body and add a `reunionId` predicate, or trust an upstream guard but document where. **Confirmed offender to fix:** `src/app/api/admin/profiles/route.ts:20-37` — the `togglePublished` action looks up a profile by id and toggles `isPublished` with no reunion check. Under the Clerk model (Phase 0), a reunion admin for tenant A could flip a profile in tenant B by providing the foreign profile id. **Preferred fix shape (no caller-contract change):** the route derives the profile's reunion via the `rsvps` join (`profiles → rsvps.reunionId`), then calls `requireReunionAdmin(resolvedReunionId)` (not `requireAnyAdmin`) so a non-super admin from tenant A is rejected when targeting a tenant-B profile. This avoids changing the existing caller payload. **Caller note:** the existing UI caller `src/app/admin/[slug]/admin-tabs.tsx:482` posts `{ profileId, action }` — under the preferred fix that payload remains valid; if the alternative "require reunion id in body" approach is chosen instead, the caller must also be updated to send `slug` (the page already has it via params). Pick the derive-and-guard approach unless there's a reason to change the contract. | Code + Audit |
| 3B.4 | Add helpers in `src/lib/db/scope.ts`. Two shapes, not one: (a) `requireRowInReunion<T extends { reunionId: string }>(row: T \| null \| undefined, reunionId: string): T` — assertion utility that calls `notFound()` if `row.reunionId !== reunionId`; use this on direct-FK tables after a `select-by-id`. (b) `whereInReunion(table: { reunionId: SQLiteColumn }, reunionId: string)` — returns a `where` predicate for direct-FK tables; helps in selects. (c) For join-scoped tables (profiles, registrationEvents, eventInterests), document the canonical join pattern in `src/lib/db/scope.ts` as comments/examples — no helper, because Drizzle's join-builder API doesn't compose cleanly behind a single helper. Refactor yearbook list, yearbook detail, yearbook print, admin profiles join, confirmation page, and sponsor confirmation to use these patterns. | Code |
| 3B.5 | Add a public-routing **active-tenant gate** that the soft-delete lifecycle currently lacks: in `src/app/[slug]/layout.tsx`, after `if (!reunion) notFound()`, also check `if (!reunion.isActive && !previewState.isAdmin) notFound()`. Document this in the `isActive` D7 decision text and Phase 5.5 QA. Without this gate, "soft-delete" only stops the root `/` redirect but the deactivated tenant remains publicly reachable at its slug — defeating the lifecycle decision. **Auth dependency:** the bypass uses `previewState.isAdmin`, which on origin/staging-pre-clerk-auth is wired to the legacy `ADMIN_PASSWORD` cookie (`src/lib/site-mode.ts:39-41`). On the clerk-auth branch, `getAdminPreviewState` already calls `getCurrentAdminContext()` and treats `isAdmin = isSuper \|\| reunionIds.includes(reunion.id)`. Phase 0 lands clerk-auth before this phase, so the bypass works correctly under the new auth foundation. If Phase 0 is somehow skipped, this gate would lock out clerk-only admins — that's just another reason Phase 0 is a hard prerequisite. | Code |
| 3B.6 | Manual QA: create a second tenant on staging — first insert a fresh `reunions` row (e.g., slug `riverside-2010-test`), then run `REUNION_SLUG=riverside-2010-test npm run db:seed-demo` against it (the parameterized script from Phase 2.5; do **not** use `db:seed-test`, which targets the fixed `phhs-1996-test` slug per Phase 2.6). Load `/{newSlug}/yearbook`, `/{newSlug}/yearbook/{phhsProfileId}` (paste a known PHHS profile id), `/admin/{newSlug}`, plus the new lookup-by-token routes (`/{newSlug}/confirmation?session_id=<phhsSession>`, `/{newSlug}/memorial/review/<phhsToken>`) — confirm none surface cross-tenant data. Then deactivate one tenant and confirm `/{slug}` returns 404 for non-admins, still serves for admins. Repeat the reverse direction. | Audit |
| 3B.7 | Add a regression test (or doc note in CLAUDE.md / a CONVENTIONS.md) that says: "Any DB read inside `[slug]/**` or `admin/[slug]/**` MUST scope to the slug's reunion — directly via `reunionId` predicate for direct-FK tables, or via the joined parent's `reunionId` for `profiles` / `registrationEvents` / `eventInterests`. Cross-tenant reads are a security regression — flag in `/review`." | Code |

**Success:** Every public and admin read inside the slug-scoped trees scopes to the
slug's reunion (directly via `reunionId` or via joined parent for join-scoped
tables). A second tenant cannot see another tenant's profiles, RSVPs, sponsors,
memorials, contact messages, interest signups, events, or registration events.
Lookup-by-id flows (Stripe-session confirmation, sponsor confirmation,
memorial review by token) verify reunion match. Soft-deleted (`isActive=false`)
tenants 404 for public visitors but remain admin-accessible. Manual QA in 3B.6
passes both directions.

#### Phase 4 — Super-admin "Create Tenant" UI + API

| # | Task | Agent |
|---|------|-------|
| 4.1 | Create `src/app/api/admin/super/reunions/route.ts` POST handler. Body: `{ slug, name, orgName, orgShortName, mascot?, classYear?, reunionMilestoneLabel?, banquetLabel?, eventDate, brandColorPrimary?, brandColorPrimaryDark?, communityServiceProjectName?, communityServiceCharityName?, communityServiceTeaserCopy?, communityServiceFullCopy?, sponsorTopTierLabel?, sponsorCommunityTierLabel?, favoriteMemoryLabel?, withDemoData: boolean, firstAdminEmail?: string }`. Steps: `requireSuperAdmin()` guard → `validateSlug(body.slug)` → check uniqueness → insert `reunions` row (siteMode="tease", isActive=true) → if `withDemoData` call `seedDemoTenant(db, reunion.id)` → if `firstAdminEmail` insert `reunion_admins` row (lowercase email, invitedByEmail = guard.email). Wrap in a transaction so partial failure doesn't leave a stub reunion. Return `{ ok: true, reunion: { slug, id } }`. Handle UNIQUE-violation on slug as 409. | Code |
| 4.2 | Create `src/app/admin/super/new-reunion/page.tsx` — server component, calls `requireSuperAdminPage()`, renders the create form via `<CreateReunionClient />`. | Code |
| 4.3 | Create `src/app/admin/super/new-reunion/create-reunion-client.tsx` — client island. Collects fields above. **Live slug validation** (debounced) hitting a small GET endpoint `/api/admin/super/reunions/check-slug?slug=...` that returns `{ ok, reason? }` from `validateSlug` + DB uniqueness. "With demo data" radio (default: yes). On submit: POST → on success redirect to `/admin/{newSlug}/settings` (where the admin can verify and adjust) or `/admin/{newSlug}` if not super-admin-only. | Code + UX |
| 4.4 | Add `src/app/api/admin/super/reunions/check-slug/route.ts` GET handler: super-admin guard, runs `validateSlug` + DB uniqueness check, returns `{ ok, reason? }`. | Code |
| 4.5 | Add a "Create new reunion" button on `src/app/admin/super/page.tsx` linking to `/admin/super/new-reunion`. | Code |
| 4.6 | Manual QA: as super admin, create a fresh tenant with demo data, hit its public URL, verify all four events render, sample data shows, sponsor page works, `/community-service` renders the demo project (not 404 — `seedDemoTenant` backfilled CS config per Phase 2.4), no PHHS strings. Then create one **without** demo data: confirm the homepage CS block is hidden and `/community-service` returns 404 (no CS config; matches Phase 3.6 / 3.7 behavior). | Audit |

**Success:** Super admin can create a new tenant from the UI, with or
without demo seed, optionally pre-assigning a reunion admin. New tenant
renders end-to-end at its slug.

#### Phase 5 — Tenant settings UI

| # | Task | Agent |
|---|------|-------|
| 5.1 | Create `src/app/admin/[slug]/settings/page.tsx` — server component. `requireReunionAdminPage(reunion.id)` guard. Loads reunion + tenant config. Renders `<SettingsClient />`. | Code |
| 5.2 | Create `src/app/admin/[slug]/settings/settings-client.tsx` — client island form for all tenant config fields + `isActive` toggle (super-admin-only) + a "Re-seed with demo data" button (super-admin-only). Form fields submit via PATCH to `/api/admin/reunion/[id]` (the field-update endpoint from 5.3). The "Re-seed with demo data" button submits via POST to `/api/admin/reunion/[id]/reseed` (the dedicated re-seed endpoint from 5.3a) — separate route because re-seed has different auth (super-only) and transaction semantics (server-side empty-tenant precondition + single-transaction seed). Show a confirmation dialog before POST. On 409 from server (`tenant not empty`), surface the offending table + row count to the admin. | Code + UX |
| 5.3 | Create `src/app/api/admin/reunion/[id]/route.ts` PATCH handler. `requireReunionAdmin(reunionId)`. Whitelists which fields a reunion-admin can edit (everything in tenant config) vs super-admin-only (`isActive`; slug is NEVER editable, document that). Ignores fields not in the whitelist. Returns updated reunion. | Code |
| 5.3a | Create `src/app/api/admin/reunion/[id]/reseed/route.ts` POST handler — separate endpoint from the field PATCH so authorization, transaction shape, and error semantics don't get tangled. Steps: `requireSuperAdmin()` guard (re-seed is super-only, not reunion-admin) → confirm the reunion id is valid → call `seedDemoTenant(db, reunionId)` which itself runs the empty-tenant precondition check defined in Phase 2.4 (throws `TenantNotEmptyError` if any tenant table has rows) → `seedDemoTenant` runs in a single transaction → on `TenantNotEmptyError` return 409 with `{ error: "tenant not empty", table, count }`; on success return `{ ok: true, seeded: <counts> }`. The settings client (5.2) calls this endpoint with a confirmation dialog ("This will populate the tenant with demo data. The tenant must currently be empty."). | Code |
| 5.4 | Add a Settings link to `src/app/admin/[slug]/page.tsx` (e.g., next to the launch icon or as a tab). | Code |
| 5.5 | Manual QA: edit each field, verify it renders correctly on the public site. Toggle `isActive=false` and verify the full soft-delete behavior added in Phase 3B.5: (a) root `/` no longer redirects to it (current first-active logic), (b) `/{slug}` and any nested page returns 404 for public/anonymous visitors, (c) the admin can still see it (admins bypass `isActive` via the layout gate added in 3B.5 and via the admin dashboard). Toggle back to `isActive=true` and verify everything restores. | Audit |

**Success:** Tenant admin can edit their reunion's config; super admin can
also flip `isActive` and trigger re-seed.

#### Phase 6 — PHHS backfill

| # | Task | Agent |
|---|------|-------|
| 6.1 | Create `src/lib/db/backfill-phhs-config.ts` — one-shot script. Looks up `phhs-1996` reunion. If found, sets: `orgName="Park Hill High School"`, `orgShortName="PHHS '96"`, `mascot="Trojans"`, `classYear="1996"`, `reunionMilestoneLabel="30 Year Reunion"`, `banquetLabel="Saturday Banquet"`, `brandColorPrimary="#b91c1c"`, `brandColorPrimaryDark="#7f1d1d"`, `communityServiceProjectName="96 Backpacks"`, `communityServiceCharityName="Replenish KC"`, `communityServiceTeaserCopy="Saturday morning, we're assembling 96 backpacks of school supplies for Park Hill students — partnering with Replenish KC."`, `communityServiceFullCopy=` (the full multi-paragraph copy migrated verbatim from `src/app/[slug]/community-service/page.tsx` before that file is generalized in 3.7 — capture it here as a string literal so the file can be safely edited), `sponsorTopTierLabel="Trojan"`, `sponsorCommunityTierLabel="Community Service Project"`, `favoriteMemoryLabel="Favorite Park Hill Memory"`. **Default mode: only-if-null** — only sets columns that are currently null, so reruns are safe even after a reunion admin has edited their settings. Add a `--force` CLI flag for the rare case where an operator wants to overwrite (e.g., recovering from a bad edit); `--force` should log a diff per column to stderr and require an explicit `CONFIRM_OVERWRITE=1` env var to actually run. Also: copies `profiles.favoritePHMemory` → `favoriteSchoolMemory` for any rows where new column is null. | Code |
| 6.2 | Add `db:backfill-phhs-config` to `package.json` scripts. | Code |
| 6.3 | Run the backfill against the **staging** database. Smoke test the live PHHS slug — every page must render identically to before. | Audit |
| 6.4 | After confirmed visual parity on staging, run the same backfill against **production** DB as part of the deploy. Document this in the deploy step (Phase 7). | Audit |

**Success:** Live PHHS reunion site renders identically post-deploy. New
columns populated, `favoriteSchoolMemory` mirrored from
`favoritePHMemory`.

#### Phase 7 — Build, QA, deploy

| # | Task | Agent |
|---|------|-------|
| 7.1 | `npx tsc --noEmit` clean across the whole tree. | Audit |
| 7.2 | `npm run build` clean. | Audit |
| 7.3 | Full QA matrix: (a) live PHHS tenant on staging, every page; (b) generic demo tenant on staging (created via super-admin create); (c) super-admin create flow with and without demo seed; (d) tenant settings edit flow; (e) Stripe Connect onboarding on a fresh demo tenant (test mode); (f) sign-out and re-sign-in as super, as reunion admin, as non-admin. | Audit |
| 7.4 | Deploy plan — ordered to **eliminate the live PHHS degradation window**. The hazard: between when the new app code starts serving and when backfill runs, the `phhs-1996` reunion has null tenant-config columns, so the home page hides the 96-Backpacks block, `/community-service` returns 404, and tier labels degrade to generic defaults. To avoid this, the backfill must run **after the migration but before traffic hits the new code**. Concretely: **(staging)** (1) merge `tenant-creation` into `staging`, (2) `npx drizzle-kit push` against staging Turso (adds the new nullable columns and `favoriteSchoolMemory` column — old code keeps working since it doesn't read them), (3) run `db:backfill-phhs-config` against staging Turso (populates PHHS values **before** new code is live), (4) push `staging` → triggers Vercel preview, (5) smoke test live PHHS slug — every page identical. **(production)** Repeat the same order: (6) merge `staging` → `main`, (7) `npx drizzle-kit push` against prod Turso, (8) run `db:backfill-phhs-config` against prod Turso, (9) push `main` → triggers Vercel prod, (10) smoke test prod PHHS slug. The backfill writing to columns the prod app doesn't yet know about is harmless; the prod app coming up and finding columns already populated is the goal. | Code + Audit |
| 7.5 | Post-deploy retro: any leftover PHHS strings spotted in production? Any 500s on edit/create paths? Update plan or open follow-up tickets. | Audit |

**Success:** PHHS continues to work identically; super admin can create new
tenants; new tenants render with demo data; all tests green.

### Dependencies

```
Phase 0  (clerk-auth merge + decisions)    → all subsequent phases
Phase 1  (schema + helpers)                → 2, 3, 3B, 4, 5, 6
Phase 2  (demo seed)                       → 4 (CreateTenant uses seedDemoTenant)
Phase 3  (de-PHHS code)                    → 3B, 6 (backfill targets new columns)
Phase 3B (cross-tenant query scoping)      → 4 (HARD GATE — no second tenant before scoping is fixed)
Phase 4  (CreateTenant UI/API)             → 5 (settings UI re-uses field set)
Phase 5  (settings UI)                     → 7 (QA matrix)
Phase 6  (PHHS backfill)                   → 7 (deploy gates on backfill)
Phase 7  (deploy)                          → final
```

### Success Criteria (rolled up)

1. Super admin clicks "Create new reunion" in `/admin/super`, fills a form,
   gets a working public site at `/{newSlug}` within seconds.
2. The "with demo data" option produces a tenant with realistic-looking but
   obviously-not-PHHS demo content.
3. The live PHHS reunion at `/phhs-1996` renders pixel-identically to its
   pre-deploy state — including hero, sponsor pages, community service page,
   confirmation page, color theme.
4. Reunion admin (non-super) can edit their tenant's config but cannot see
   or edit other tenants — enforced both at page guard and PATCH route, AND
   no public or admin slug-scoped query leaks rows from other tenants
   (Phase 3B sweep).
5. Slug validation rejects reserved words, malformed slugs, and duplicates;
   live-validates in the create form.
6. Zero PHHS strings remain in `src/` outside of `canonical-events-phhs.ts`,
   `backfill-phhs-config.ts`, and archived plan docs.
7. `npm run build` is clean; `tsc --noEmit` clean; manual QA matrix in 7.3
   passes.

### Risk Areas

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | **Phase 0 sequencing** — clerk-auth must land on origin/staging first or this entire plan can't compile (every admin guard reference fails). | Phase 0 explicitly stops for confirmation. Don't start Phase 1 until rebase is clean. |
| R2 | **Backfill timing** — running backfill before `drizzle-kit push` → "no such column" error. Running app deploy before backfill → live PHHS tenant degrades visibly (community-service 404, hidden 96-Backpacks block, generic tier labels) for the duration of the gap. | Phase 7.4 ordering is: migration first, backfill second, app deploy third. The backfill writes to columns that exist (post-migration) but isn't yet read by live code (pre-deploy) — when the deploy lands, columns are already populated. |
| R3 | **`drizzle-kit push` on Turso** — adding a column is normally fast/safe, but renaming via copy-then-drop has historically required two deploys for safety. The plan keeps the old `favoritePHMemory` column in place; Phase 6 only writes to the new one + backfills. Drop is deferred. | Phase 3.1 / 6.1 split. Drop column in a follow-up plan once both columns proven equal in prod for 1+ week. |
| R4 | **Cross-tenant leak via super admin "Re-seed"** — a super admin clicking re-seed on a tenant that has data could nuke production data. | Server-side guard: `seedDemoTenant` throws unless events / rsvps / sponsors / etc. are all empty for the reunion. UI confirmation dialog. |
| R5 | **Slug squatting / reserved words** — someone creates `slug=admin` or `slug=api`, breaks routing. | `validateSlug` reserved-word list (Phase 1.5) + DB uniqueness. |
| R6 | **Tailwind class sweep is bounded** — Phase 3.10 sweep covers the home page, sponsor / sponsors, community-service, confirmation, and site-nav. Pages NOT covered (and therefore still hardcoded red on a non-PHHS tenant): `[slug]/yearbook/page.tsx`, `[slug]/yearbook/[profileId]/page.tsx`, `[slug]/yearbook/print/page.tsx`, `[slug]/memorial/page.tsx`, `[slug]/schedule/page.tsx`, `[slug]/rsvp/page.tsx`, `components/tease-landing.tsx`, plus admin chrome and status badges (intentional — admin chrome is platform UI, not tenant-themed). Success Criterion #3 ("PHHS pixel-identical") is unaffected. **Non-PHHS tenants see mixed branding** until a follow-up sweep ships. | Documented residual; follow-up plan will sweep yearbook/memorial/schedule/rsvp/tease pages. Backfill sets red as PHHS's brand so PHHS itself is unchanged. |
| R7 | **Stripe Connect per-tenant** — every new tenant must complete its own Stripe onboarding before payments work. The CreateTenant flow can't pre-configure Stripe. | Behavior already correct — tenant settings page surfaces Connect status. Documented in 4.6 QA. |
| R8 | **Demo seed sample emails** — `sample.com` / `example.com` addresses can collide if multiple demo tenants share an email pool. | Each demo seed namespaces sample emails by reunion id (e.g., `sarah.{id8}@example.com`) to avoid uniqueness conflicts where unique-on-(reunion,email) doesn't apply. |
| R9 | **Custom domain / subdomain** — left for later; product may demand it sooner than expected. | D2 deferred. If needed: revisit in a separate plan. |
| R10 | **Root `/` redirect logic** with N tenants picks "first active" arbitrarily. | D8 deferred; current behavior is acceptable for v1. |
| R11 | **Cross-tenant query leaks** — even with reunionId on every direct-FK table, multiple existing reads in `[slug]/**` and `admin/[slug]/**` don't filter on it; some tenant-scoped tables (profiles, registrationEvents, eventInterests) have no `reunionId` column and reach the reunion only via a join. Invisible with one tenant, becomes a data leak the moment a second tenant exists. | Phase 3B explicitly fixes the confirmed offenders (yearbook list, yearbook detail, yearbook print, admin profiles join, confirmation, sponsor confirmation, memorial review, admin profiles toggle), sweeps for more, and adds two helpers in `src/lib/db/scope.ts` (`requireRowInReunion` for post-select assertions on direct-FK rows, `whereInReunion` for select predicates on direct-FK tables) plus documented join patterns for the join-scoped tables. Adds a CLAUDE.md / CONVENTIONS note so future code adopts the pattern. Phase 4 (CreateTenant) is gated on Phase 3B passing — no second tenant ships before queries are scoped. |

---

## Self-Audit (Step 3)

### Findings against the first-draft plan

- **[BLOCKER] Phase 0 sequencing assumed clerk-auth was already on origin/staging.** It isn't (origin/staging tip is `f17a265`; clerk-auth merge `c8aafbf` is local-only). → **Fix:** Phase 0.1 adds the explicit "decide whether to push clerk-auth" step before any other work. Already incorporated above.

- **[BLOCKER] `seedDemoTenant` would conflict with existing data.** First draft said "lays down sample data". Without an empty-tenant guard, calling it on an existing tenant produces dupes / FK violations. → **Fix:** task 2.4 specifies "throws clearly if not empty"; task 5.2 makes "Re-seed with demo data" gated on emptiness; risk R4 captures this.

- **[BLOCKER] Slug `validateSlug` missing — first draft assumed any string works.** Reunion routing is on `[slug]` with no regex constraint; without validation a super admin could create slug `admin` and break the entire admin tree. → **Fix:** task 1.5 + 4.1 + 4.4 added.

- **[BLOCKER] `loadProdShell` falls back to PHHS defaults** — first draft renamed it to `loadDemoShell` but didn't say "drop the PHHS fallback". A test tenant created with a fresh DB (no `phhs-1996` row) would get PHHS shell back. → **Fix:** task 2.6 explicit: drop PHHS fallback, return generic shell unconditionally.

- **[WARNING] `favoritePHMemory` rename strategy** unclear in first draft. Drizzle-kit doesn't safely rename SQLite columns — table rebuild is the underlying mechanism, which fails on busy tables. → **Fix:** copy-then-drop pattern (3.1 + 6.1 + future plan), instead of rename. Both columns coexist temporarily.

- **[WARNING] PHHS backfill before prod deploy** would crash because new columns don't exist yet in prod. → **Fix:** Phase 7.4 strictly orders push-to-prod first, then backfill. Risk R2 captures this.

- **[WARNING] CSS-vars theming sweep** is unbounded as written. There are dozens of `bg-red-700` / `text-red-700` occurrences across the codebase, and some are intentional (admin chrome, status badges) — not all should switch. → **Fix:** task 3.10 bounded to the tenant-public pages list. Risk R6 documents the residual.

- **[WARNING] Sample-data email uniqueness.** Same emails hardcoded in `seed-test.ts` (sarah.mitchell@example.com etc.) inserted into two demo tenants would still be fine because there's no unique-across-reunions email constraint on `rsvps` — but `interestSignups` has unique on `(reunionId, email)` so it's per-tenant. Profiles use `rsvpId`. So actually the only collision risk is if a real attendee uses `sarah.mitchell@example.com` later. Low risk; flag only. → **Fix:** task 2.4 + risk R8 mention namespacing emails by reunion-id-suffix.

- **[WARNING] Reunion-admin-can-edit-everything** in tenant settings includes `isActive`, which is a global-visibility toggle. Should be super-admin-only (a reunion admin shouldn't be able to deactivate themselves out of the picture). → **Fix:** task 5.3 whitelist split: super-admin-only for `isActive`, slug, anything else?

- **[NIT] Demo tenant data has nothing to recommend it visually if there's no Stripe Connect.** Sponsor cards render but "checkout" path is gated until Connect is set up (per Stripe Connect plan task 9). On a brand-new demo tenant for a demo viewer, this looks broken. → **Fix:** acceptable — the create-tenant flow's success page can recommend "Set up Stripe to enable sponsor / banquet payments" as a next step. Out of scope for the PLAN; mention as follow-up.

- **[NIT] `reunionMilestoneLabel` storage vs derivation** — could be derived from `classYear` + `eventDate.getFullYear()`. Storing it lets tenants override when the math is off (e.g., COVID-delayed reunions). Storing wins. Document the rationale. → **Fix:** task 1.1 explanatory comment.

### Residual Risk

- Even with R6 bounded sweep, a tenant with a non-red brand color will see
  red-themed admin chrome and some legacy public components. Acceptable
  for v1 but accumulates as visual debt. A second-pass plan should sweep
  the remaining `red-*` classes.
- The first reunion-admin assignment in CreateTenant only takes one email.
  Real-world reunions have committees of 3-5. The settings page (Phase 5)
  doesn't yet expose admin management at the tenant level — `/admin/super/admins`
  remains the only way to add more admins. Acceptable; flag for follow-up.
- The plan does not address per-tenant override of `NEXT_PUBLIC_AMAZON_WISHLIST_URL`.
  That env var is currently global; any tenant with a community-service
  project that uses an Amazon Wish List would share the URL. Acceptable
  short-term; add per-tenant column in a follow-up.
- Phase 0.1 requires Ryan to confirm pushing clerk-auth → origin/staging.
  If Ryan declines (perhaps clerk-auth needs more review), the whole plan
  blocks. Plan Phase 0 surfaces this rather than racing past it.

---

## Convergence Audit (filled in by /converge in Step 6)

### Iteration 1

Codex returned 6 findings (2 BLOCKER, 4 WARNING) plus 3 cleared concerns. All 6 classified AGREE and applied to the plan in this same iteration.

**[BLOCKER → fixed in Phase 7.4 + R2]** Live PHHS degradation window: deploying new code before backfilling left PHHS visitors with null tenant-config columns (community-service 404, hidden 96-Backpacks block). Reordered Phase 7.4 to: migration → backfill → app deploy. The backfill writes columns that the live code doesn't yet read; when the deploy lands, columns are already populated.

**[BLOCKER → fixed by adding Phase 3B]** Cross-tenant query leaks already exist in `[slug]/yearbook/page.tsx`, `[slug]/yearbook/[profileId]/page.tsx`, `[slug]/yearbook/print/page.tsx`, and `admin/[slug]/page.tsx` (profiles join). Plan never addressed it — invisible with one tenant, becomes a data leak when a second exists. Added Phase 3B as a hard gate before Phase 4 (CreateTenant) ships. New helper `scopedToReunion` and a CLAUDE.md/CONVENTIONS note. Risk R11 added.

**[WARNING → fixed in Phase 6.1 + R6 description]** "Always overwrite" backfill is a foot-gun once admins start editing tenant config. Changed default to `--only-if-null`; explicit `--force` flag plus `CONFIRM_OVERWRITE=1` env required for overwrite mode.

**[WARNING → fixed in Phases 1.1, 3.6, 3.7, 6.1]** Community-service had a single `communityServiceCopy` column but Phase 3 used it for both home-page teaser and full page, while Phase 6 said the backfill needs both a sentence and a longer version. One column couldn't faithfully hold both. Split into `communityServiceTeaserCopy` + `communityServiceFullCopy`; Phase 6.1 backfills both with PHHS-specific copy.

**[WARNING → fixed in Phase 2.4]** `seedDemoTenant` empty-tenant precondition was loosely "events / rsvps / sponsors / etc." Plan now enumerates every tenant-scoped table (events, rsvps, profiles via rsvp join, sponsors, memorials, interestSignups, eventInterests via signup join, registrationEvents via rsvp join, contactMessages) in the guard, throws `TenantNotEmptyError(tableName, count)`, runs in a single transaction.

**[WARNING → clarified R6]** Phase 3.10 bounded sweep didn't cover all public visitor pages — yearbook/memorial/schedule/rsvp/tease still hardcode red. R6 now explicitly lists which pages are excluded so reviewers know what "bounded" means. Success Criterion #3 (PHHS pixel-identical) unaffected. Non-PHHS tenant branding mismatch is documented residual debt.

**Cleared concerns:** (3) super-admin redirect target reachable post-CreateTenant — confirmed by clerk-auth's `requireReunionAdminPage` super bypass; (4) reserved-slug list adequate — `_next`, `admin`, `api`, auth routes all covered, slug format forbids dots so asset filenames can't collide; (6) Phase 0.1 declination handling — correctly blocks the plan rather than racing past it; a Plan B would be a separate reduced-scope plan.

**Iteration 1 outcome:** 6 fixes applied to plan file, no items paused. Ready for iteration 2 to verify nothing regressed.

### Iteration 2

Codex re-audited the plan after iteration-1 fixes. Returned 5 new WARNINGs — 3 are coherence issues introduced by iteration-1 changes; 2 surfaced higher because Phase 3B's introduction made cross-tenant scoping a focal area. All 5 classified AGREE and applied.

**[WARNING → expanded Phase 3B.1]** The phase-3B sweep target list named only the yearbook + admin-profile offenders. Three more lookup-by-id/token public routes leak across tenants without verification: `[slug]/confirmation/page.tsx:36-41` (rsvp by Stripe session), `[slug]/sponsor/confirmation/page.tsx:24` (sponsor by id), `[slug]/memorial/review/[token]/page.tsx:14` (memorial by token). Added all three to 3B.1's confirmed offenders list.

**[WARNING → redesigned Phase 3B.4]** The single `scopedToReunion(query, table, reunionId)` helper signature didn't fit the schema. `profiles`, `registrationEvents`, and `eventInterests` have no `reunionId` column — they reach the reunion by joining through `rsvps` or `interestSignups`. Phase 3B now adds two helpers (`requireRowInReunion` for post-select assertions, `whereInReunion` for predicates on direct-FK tables) plus documented join patterns for the three join-scoped tables. Also added an explicit "Schema note" at the top of Phase 3B distinguishing direct-FK from join-scoped tables so future readers understand which pattern fits which table.

**[WARNING → fixed Phase 4.1]** Phase 4.1's POST body still referenced `communityServiceCopy?` (the old single field name from before iteration-1's split). Replaced with `communityServiceTeaserCopy?, communityServiceFullCopy?`. Also added `banquetLabel?` to Phase 4.1's body (see next finding).

**[WARNING → fixed Phase 1.1, 6.1]** Phase 3.6 referenced `tenantConfig.banquetLabel` for the "Saturday Banquet" replacement, but that field was never added to the schema in 1.1, never collected in 4.1, never editable in 5.x, never backfilled in 6.1. Added `banquetLabel` to Phase 1.1's column list (default "Banquet" when null) and Phase 6.1's PHHS backfill values (`banquetLabel="Saturday Banquet"`).

**[WARNING → added Phase 3B.5 and updated 5.5 + D7]** `isActive=false` lifecycle was a routing gap: the plan claimed soft-delete but only the root `/` redirect respected `isActive`. The slug layout (`[slug]/layout.tsx:18-24`) only checks `if (!reunion) notFound()`, so deactivated tenants remain publicly reachable at their slug. Added new task 3B.5 — gate the slug layout on `isActive` with admin bypass. Updated 5.5 QA to cover the full soft-delete behavior (root, slug, admin bypass). Updated D7 default narrative to make this explicit.

**Iteration 2 outcome:** 5 fixes applied. No new findings paused. Ready for iteration 3 verification.

### Iteration 3

Codex re-audited after iteration-2 fixes. Returned 3 new WARNINGs, all AGREE'd and applied.

**[WARNING → clarified Phase 3B.5]** The new inactive-tenant gate uses `previewState.isAdmin` for the admin bypass. On the current worktree (pre-clerk-auth), `getAdminPreviewState` only knows the legacy `ADMIN_PASSWORD` cookie. The bypass works correctly only **after** clerk-auth lands (Phase 0), where `getAdminPreviewState` is already wired to `getCurrentAdminContext`. Added an explicit auth-dependency note to 3B.5 so reviewers don't think the gate ships against the legacy cookie. (Verified by `git show clerk-auth:src/lib/site-mode.ts` — clerk-auth branch already updated this helper.)

**[WARNING → fixed Phase 3B.6]** The QA flow said to seed a second tenant via `db:seed-test`, which Phase 2.6 explicitly says still targets the fixed `phhs-1996-test` slug for backward compat. The parameterized script is `db:seed-demo` (Phase 2.5, takes `REUNION_SLUG` env var). Rewrote 3B.6 to: insert a fresh `reunions` row, then `REUNION_SLUG=... npm run db:seed-demo`. Cross-referenced 2.5 and 2.6 explicitly so the QA tooling matches the seed tooling defined earlier in the plan.

**[WARNING → expanded Phase 3B.3 with confirmed offender]** `src/app/api/admin/profiles/route.ts:20-37` is a concrete cross-tenant write hole: the `togglePublished` action looks up a profile by id and toggles `isPublished` with no reunion check. Phase 3B.3's generic "sweep mutation routes" was directionally right but didn't name this offender. Added explicit fix instructions: derive the profile's reunion via the `rsvps` join, require the request to carry the reunion id (or path slug), reject if mismatched, then call `requireReunionAdmin(reunionId)` against the resolved id (not just `requireAnyAdmin`).

**Iteration 3 outcome:** 3 fixes applied. No new findings paused. Ready for iteration 4 verification.

### Iteration 4

Codex re-audited after iteration-3 fixes. Returned 3 findings: 2 WARNINGs and 1 NIT. All AGREE'd and applied (NIT batched in this same pass since it's a one-line doc fix in the same edit context).

**[WARNING → reshaped Phase 3B.3 fix to avoid caller change]** Iteration 3 tightened the `togglePublished` API to "require the request body to also carry the reunion id". But the existing UI caller `src/app/admin/[slug]/admin-tabs.tsx:482` posts only `{ profileId, action }` — tightening the contract without updating the caller would break the publish toggle flow. Switched to the simpler "derive-and-guard" shape: the route resolves the profile's reunion via the `rsvps` join, then calls `requireReunionAdmin(resolvedReunionId)` against that resolved id. Caller payload stays unchanged. The plan now also notes the caller location for the fallback approach in case derive-and-guard turns out to be impractical during implementation.

**[WARNING → added Phase 5.3a; updated 5.2]** The "Re-seed with demo data" UI button had no defined server contract — Phase 5.2 said it submits via PATCH to `/api/admin/reunion/[id]` but Phase 5.3 only defined config-field PATCH semantics, with no reseed branch, no request shape, no transaction notes. Created a separate endpoint `POST /api/admin/reunion/[id]/reseed` (Phase 5.3a) with explicit super-admin guard, server-side empty-tenant precondition (delegated to `seedDemoTenant`'s check from 2.4), 409 on TenantNotEmptyError, single-transaction seed. Updated Phase 5.2 to point the button at the new endpoint and require a confirmation dialog.

**[NIT → fixed R11]** Risk R11 still referenced the retired single-helper name `scopedToReunion`. Iteration 2 redesigned that into `requireRowInReunion` + `whereInReunion` + documented join patterns. Updated R11's mitigation paragraph to match the actual helper set so reviewers don't search for a non-existent abstraction.

**Iteration 4 outcome:** 3 fixes applied. No new findings paused. Findings trend: 6 → 5 → 3 → 3 (severity dropping: 1 NIT this round). Ready for iteration 5 verification — likely convergence.

### Iteration 5

Codex re-audited after iteration-4 fixes. Returned 2 new WARNINGs, both about `seedDemoTenant` semantics. AGREE'd and applied.

**[WARNING → expanded Phase 2.4]** Demo-seeded tenants land in an inconsistent state when CS config fields are null: the seed lays down a Saturday community-service event (Phase 2.2), but Phase 3.6 hides the homepage CS block and Phase 3.7 returns `notFound()` on `/community-service` when `communityServiceProjectName` is null. Phase 4.1 makes those fields optional, so a tenant could easily end up with a CS event but no CS page. Fix: `seedDemoTenant` now backfills demo CS config fields ("School Supply Drive" + teaser + full copy) inside the same transaction when they're null. Self-consistent demo tenant out of the box.

**[WARNING → tightened Phase 2.4 contract]** The signature `seedDemoTenant(db, reunionId, opts?: { eventDate?: string })` advertised an `eventDate` opt that no caller (4.1, 5.3a, 2.5 CLI) actually passes, while Phase 3.6 derives the homepage date display from `reunion.eventDate`. Risk: seeded event timestamps could desync from the homepage date. Fix: removed `opts.eventDate`; `seedDemoTenant` now reads `reunion.eventDate` from the row directly and anchors all seeded event datetimes to it. Throws `ReunionMissingEventDateError` if null (defense-in-depth — the create flow collects eventDate as required).

**Iteration 5 outcome:** 2 fixes applied to a single task (Phase 2.4). No new findings paused. Findings trend: 6 → 5 → 3 → 3 → 2 (still decreasing). Ready for iteration 6.

### Iteration 6 — Convergence

Codex re-audited and explicitly stated: "Aside from [one stale QA sentence], the plan looks converged. The earlier substantive classes of issues have been closed: rollout ordering avoids PHHS degradation, cross-tenant read/write scoping is now explicitly gated before second-tenant creation, `seedDemoTenant` has a coherent single-source-of-truth date model plus empty-tenant and transactional guarantees, and the community-service split/backfill now aligns homepage/page/demo behavior. Remaining residuals are documented v1 tradeoffs rather than internal contradictions."

The single remaining WARNING was a downstream consequence of iteration-5's CS-config backfill change: Phase 3.15 still said `/community-service` should 404 for the test tenant, but the test tenant is now seeded with backfilled demo CS config so the page renders. Updated Phase 3.15 to expect render-not-404 for the seeded test tenant; updated Phase 4.6 so the blank-tenant 404 case is covered there instead.

**Iteration 6 outcome:** 1 fix applied. CONVERGED — no remaining substantive findings. Findings trend: 6 → 5 → 3 → 3 → 2 → 1.

---

## Convergence Summary

| Iter | Findings | Severity Mix | Fixed | Paused | Notes |
|---|---|---|---|---|---|
| 1 | 6 | 2 BLOCKER, 4 WARNING | 6 | 0 | Architectural (deploy ordering, missing query-scope phase) |
| 2 | 5 | 5 WARNING | 5 | 0 | Coherence after iter-1 fixes; new isActive gate |
| 3 | 3 | 3 WARNING | 3 | 0 | Auth-dep clarity; tooling cross-refs; named API offender |
| 4 | 3 | 2 WARNING, 1 NIT | 3 | 0 | Caller-API contract; reseed endpoint; doc drift |
| 5 | 2 | 2 WARNING | 2 | 0 | seedDemoTenant date contract + CS config backfill |
| 6 | 1 | 1 WARNING | 1 | 0 | Stale Phase 3.15 QA doc consequence of iter-5 |
| **Total** | **20** | **2 BLOCKER, 17 WARNING, 1 NIT** | **20** | **0** | |

**Paused items:** None across all iterations. Every Codex finding was AGREE'd with specific reasoning and fixed in-place.

**Residuals (acceptable for v1, already documented in Risks/Decisions):**
- R6 — bounded theme sweep leaves yearbook/memorial/schedule/rsvp/tease pages with hardcoded red on non-PHHS tenants. Documented; follow-up plan needed.
- R9 — custom domain / subdomain deferred (D2).
- R10 — root `/` first-active redirect arbitrary (D8).
- D9 — legacy `registration_open` column not dropped.
- Per-tenant `NEXT_PUBLIC_AMAZON_WISHLIST_URL` override not addressed (mentioned at end of self-audit).
- Multi-admin assignment in CreateTenant is single-email; settings UI doesn't add admins (use `/admin/super/admins`).
