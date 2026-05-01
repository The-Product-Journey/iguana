# PLAN: Clerk Admin Auth Migration with Per-Tenant Admins + Super Admins

## Step 1 Context Summary

**Project:** PHHS Class of 1996 reunion app. Built on Next.js 16.1.7 (App Router) + React 19.2.3, Drizzle ORM on Turso (libSQL), Vercel Blob, Stripe + Stripe Connect. Hosted on Vercel team `hively`, project `phhs1996`. Production branch `main`; dev work on `staging`. The codebase is **already multi-tenant by structure** — schema has a `reunions` table with `slug`, and admin pages live under `src/app/admin/[slug]/*`. Today only one reunion exists, but the data model is ready for more.

**Current admin auth (what we're replacing):**
- Single shared `ADMIN_PASSWORD` env var.
- `/api/admin/login` route stores the password as the cookie value itself (plaintext-password-in-cookie, real security smell).
- 27 references across 14 files: `src/app/admin/layout.tsx`, `src/lib/site-mode.ts`, 12 route files under `src/app/api/admin/**` (login, logout, memorial, preview-mode, profiles, site-mode, sponsors, toggle-registration, plus connect/{create,onboarding-link,login-link,status}). After deleting `login` + `logout`, **10 admin handlers** remain to refactor. Plus `src/components/admin-login.tsx` and `src/components/admin-menu.tsx` (which currently posts a sign-out form to the to-be-deleted `/api/admin/logout`).
- `admin_preview_mode` cookie is a separate UI-state cookie (set by `/api/admin/preview-mode`, read by `getAdminPreviewState()` in `src/lib/site-mode.ts`). **Stays.**

**Decisions (with the new role-model requirement baked in):**
- **Provider:** Clerk (`@clerk/nextjs`).
- **Sign-in providers:** email magic link + Google SSO. Public sign-up disabled in Clerk dashboard.
- **Role model — two tiers:**
  - **Super admin.** Sourced from env var `SUPER_ADMIN_EMAILS` (CSV, lowercased on compare). Can do anything in any reunion. Bootstraps the system (so there's no chicken-and-egg DB problem) and stays small (you + a couple others). Lives in env var, not DB.
  - **Reunion admin.** Per-tenant scope. Sourced from new DB table `reunion_admins` linking an email (and eventually a `clerkUserId`) to a `reunion_id`. Same email can be admin for multiple reunions via multiple rows. Managed by super admins.
- **Enforcement model:**
  - `clerkMiddleware()` gates `/admin(.*)` and `/api/admin(.*)` at the edge — confirms a Clerk session exists and the email is *some* kind of admin (super OR has at least one row in `reunion_admins`). Non-admins go to `/admin/forbidden` (page) or 403 JSON (API).
  - Inside route handlers, a `requireSuperAdmin()` / `requireReunionAdmin(reunionId)` / `requireAnyAdmin()` helper enforces fine-grained scope. Defense in depth.
- **Sign-out:** Clerk's `<UserButton afterSignOutUrl="/" />`, preserving the recent committed behavior ("Sign out drops user at site root").
- **Workspace:** sibling worktree `/Users/ryan/Development/product-journey/iguana-clerk-auth` on branch `clerk-auth` off `staging` (b69907d). Already created.

**Conventions found:**
- `CLAUDE.md` lists gstack skills only; no codebase-style rules.
- No existing `proxy.ts`. Next.js 16 uses `proxy.ts` (not `middleware.ts` — that name only works on Next 15 and earlier per Clerk docs). Will be created at `src/proxy.ts`.
- No test infrastructure. Verification = local smoke + `npm run build` + curl + preview-deploy.
- **Drizzle workflow is `db:push` only** (no `drizzle/` directory, no `db:generate` / `db:migrate` scripts, schema is push-applied directly). This plan adds the `reunion_admins` table via the same `db:push` flow used everywhere else in the project — no introduction of formal migrations, since that would be its own scope expansion.

**Out-of-scope follow-ups:**
- A super-admin UI to add/remove reunion admins (for v1, super admin edits the table via a tiny `/admin/super/admins` page that's added in this plan, but advanced features like email invites are deferred).
- Promoting `super_admin` from env var to a DB column on `reunion_admins` (e.g., a `role` column) — defer until super-admin set is mutable.
- Per-event admin scoping (admin for a single event within a reunion). Not currently needed.
- MFA enforcement — Clerk dashboard default; revisit later.
- Migrating the user-profile edit-token (UUID) system — that's the public profile flow, unrelated.

---

## Plan (Conductor Protocol)

### Objective
Replace the hand-rolled `ADMIN_PASSWORD`-cookie admin auth with Clerk-based authentication that supports two tiers — env-var-sourced **super admins** with global access, and DB-table-sourced **reunion admins** scoped to specific reunions — while preserving existing admin UX (preview mode, dashboard, Stripe Connect) and not gating any public or webhook routes.

### Scope / Out of Scope

**In scope**
- Install Clerk SDK; wrap `<ClerkProvider>` in root layout.
- Create `src/proxy.ts` (Next 16 name; **not** `middleware.ts`) gating only admin routes.
- Dedicated `/sign-in` route using Clerk's `<SignIn />`.
- New Drizzle schema: `reunion_admins(id, reunionId, email, clerkUserId?, invitedByEmail?, createdAt)` with unique `(reunionId, email)` index. Applied via `npm run db:push` (project's existing workflow).
- `src/lib/admin-auth.ts` exporting role-aware helpers: `isSuperAdmin`, `isReunionAdmin`, `getCurrentAdminContext`, `requireSuperAdmin`, `requireReunionAdmin(reunionId)`, `requireAnyAdmin`.
- Identify the reunion context for each of the 10 admin API handlers; refactor each to call the right helper.
- **Page-level scope check.** Add `requireReunionAdminPage(reunion.id)` after slug resolution in `src/app/admin/[slug]/page.tsx` (and any other slug-scoped admin page) so middleware's coarse "any admin" gate is tightened to "admin for this reunion."
- **Cross-tenant data leak fix (folded in from audit finding #3).** In `src/app/admin/[slug]/page.tsx`, the profiles query joins `profiles` to `rsvps` without a `WHERE rsvps.reunionId = reunion.id` predicate. Today it's dormant (single reunion); the moment per-tenant admins land it becomes exploitable. Add `.where(eq(rsvps.reunionId, reunion.id))` (and audit any sibling slug-scoped reads in the same file).
- Refactor `src/lib/site-mode.ts` `isAdmin` to use Clerk + role check.
- Adjust admin UI:
  - `src/app/admin/page.tsx` becomes a router: super admin → `/admin/super`; reunion admin with one reunion → that reunion's dashboard; reunion admin with multiple → list.
  - Add `src/app/admin/super/page.tsx` (super-admin-only landing).
  - Add `src/app/admin/super/admins/page.tsx` + matching API for super admins to list/add/remove reunion admins.
  - Add `src/app/admin/forbidden/page.tsx` (its route is excluded from the "redirect unauthorized to forbidden" rule in proxy.ts to prevent loops).
  - Update `src/components/admin-menu.tsx` to use Clerk `<UserButton />` instead of posting to the deleted `/api/admin/logout` route. Move `admin_preview_mode` cookie cleanup into a Clerk `signOut` callback (or an explicit "Exit preview" action) so the cookie still gets cleared.
- Delete `/api/admin/login`, `/api/admin/logout`, `src/components/admin-login.tsx`.
- Add Clerk env vars + `SUPER_ADMIN_EMAILS` to **`.env.example`** (the project's existing example file — not `.env.local.example`) and Vercel `production` + `preview` envs.
- Local + preview-deploy validation.
- Comms note for committee on the new sign-in flow.

**Out of scope (deferred)**
- Email-invite flow for adding reunion admins (super admin enters an email; for v1 they just need to know what to enter).
- Moving super-admin source from env var to a DB role column.
- Per-event admin scoping.
- MFA enforcement.
- Audit log of admin actions.

### Micro-Tasks (sequential, atomic)

| # | Task | Agent | Verifies via |
|---|------|-------|--------------|
| 1 | Confirm working dir is `/Users/ryan/Development/product-journey/iguana-clerk-auth` and branch is `clerk-auth`. | Code | `pwd && git branch --show-current` |
| 2 | **USER ACTION**: Create Clerk **dev** application in Clerk dashboard. **Sign-up policy: "Restricted"** (not fully off — fully off prevents email allowlists from working at all in some configurations; "Restricted" lets us pre-populate users while disallowing public self-signup). Enable Email magic-link + Google providers. **Configure session token to include the user's primary email as `email`** so server-side code can read `sessionClaims.email` without a Backend API roundtrip. In Clerk dashboard → Sessions → Customize session token, set the JWT template to include `{ "email": "{{user.primary_email_address}}" }`. Capture `pk_test_*` and `sk_test_*`. The plan's app-level allowlist is the authoritative gate; Clerk-level restriction is defense in depth. | User | Keys captured; sign-up policy confirmed; session-token JWT template configured (verify by signing in and inspecting the session token in DevTools — should contain `email`). |
| 3 | **USER ACTION**: Provide `SUPER_ADMIN_EMAILS` value (CSV) — at minimum Ryan's email. Provide initial `reunion_admins` rows for the PHHS reunion (committee email list). | User | Email lists provided. |
| 4 | Install `@clerk/nextjs` via `npm install @clerk/nextjs` in the worktree. | Code | `npm ls @clerk/nextjs` exits 0; no peer-warning errors against Next 16 / React 19. |
| 5 | Update `.env.example` (the project's existing example file) to list: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `SUPER_ADMIN_EMAILS`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/admin`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL=/`. Populate local `.env.local` with dev values. | Code | File present; smoke tests confirm values resolve. |
| 6 | Add the `reunionAdmins` table to `src/lib/db/schema.ts`. Columns: `id` (uuid pk), `reunionId` (FK → reunions.id), `email` (text, lowercased on insert), `clerkUserId` (text, nullable — populated on first sign-in by that email), `invitedByEmail` (text, nullable), `createdAt`. Unique index on `(reunionId, email)`. | Code | Schema compiles; type generates. |
| 7 | Apply the schema change locally with the project's existing workflow: `npm run db:push`. **No migration files generated** — this project uses `db:push`, not `drizzle-kit migrate`. Confirm table exists in local Turso (`select * from reunion_admins;`). | Code | `db:push` exits 0; query returns empty set. |
| 8 | Write a one-shot seed script `src/lib/db/seed-admins.ts` that reads a JSON list and inserts initial `reunion_admins` rows. Run it for the PHHS reunion using the list from task 3. (Idempotent: skip rows that already exist via the unique index. Wrap in try/catch and log any failures.) Add `db:seed-admins` script to `package.json` mirroring the existing `db:seed` pattern. | Code | Seed run succeeds; rows visible in DB. |
| 9 | *(removed — was migration-apply step; collapsed into task 7's `db:push` workflow.)* | — | — |
| 10 | Wrap root layout with `<ClerkProvider>` in `src/app/layout.tsx`. Pass through env-driven URLs. | Code | App renders; no console errors. |
| 11 | Create `src/lib/admin-auth.ts` exporting:<br>• `isSuperAdmin(email): boolean` — splits `SUPER_ADMIN_EMAILS` on `,`, applies `.map(s => s.trim().toLowerCase()).filter(Boolean)`, then membership-tests. Empty/missing env returns `false` for everyone (fail-closed for super tier).<br>• `isReunionAdmin(email, reunionId): Promise<boolean>` — DB query against `reunion_admins`. **Wrapped in try/catch: if the table does not exist or the query throws, log and return `false`** (fail-closed runtime safety net for the migration-vs-deploy ordering risk).<br>• `getCurrentAdminContext(): Promise<AdminContext \| null>` — calls Clerk `auth()`. Reads email via `sessionClaims.email` (set up in Clerk dashboard as a session claim) **rather than calling `currentUser()` on every request** — `currentUser()` makes a Backend API call with rate limits and is too expensive to invoke from public pages via `getAdminPreviewState()`. Falls back to `currentUser()` only when sessionClaims.email is unavailable. Returns `{ userId, email, isSuper, reunionIds: string[] }` or `null` if not signed in.<br>• `requireSuperAdmin()`: returns context or `NextResponse.json({error:"forbidden"},{status:403})`.<br>• `requireReunionAdmin(reunionId)`: super admins always pass; reunion admins must have a row matching that reunionId; otherwise 403.<br>• `requireAnyAdmin()`: passes if super or any-reunion admin.<br>• Page-redirect counterparts (`requireSuperAdminPage`, `requireReunionAdminPage`, `requireAnyAdminPage`) that use Clerk's `redirectToSignIn({ returnBackUrl: <current url> })` for unauth (preserves deep-link target) and `redirect("/admin/forbidden")` for unauthorized.<br>• Side-effect on first call: if user signed in but `clerkUserId` is null on a matching `reunion_admins` row by email, populate it. **Wrap in try/catch with `console.error` on failure** — not bare fire-and-forget, since unhandled rejections crash Next request handlers. The backfill is best-effort; failures must not break the request. | Code | Types compile; unit-style smoke in subsequent tasks. |
| 12 | Create `src/proxy.ts` (**not `middleware.ts`** — Next.js 16 renamed the file; `middleware.ts` would silently not run) using `clerkMiddleware()`.<br>**Matcher**: `/admin(.*)` and `/api/admin(.*)` only. Because the matcher is narrow, no exclusion list is needed — public routes (`/api/webhooks/*`, `/api/interest`, `/api/contact`, `/api/memorial`, `/api/memorial/review`, `/api/checkout`, `/api/register`, `/api/profile`, `/api/sponsor-checkout`, `/api/health`, `/api/pre-register`, all static assets, `/sign-in(.*)`) simply don't match the matcher and aren't run through the proxy. Document the matcher as "narrow allowlist; never broaden without auditing every excluded path."<br>**Logic for matched routes**:<br>  1. If path is `/admin/forbidden`, **let it through unconditionally** (so an unauthorized user redirected here doesn't redirect-loop back to itself).<br>  2. If not signed in: page routes call `redirectToSignIn({ returnBackUrl: req.url })`; API routes return 403 JSON.<br>  3. If signed in but neither super nor any-reunion admin: page routes redirect to `/admin/forbidden`; API routes return 403 JSON.<br>(Per-reunion scope is enforced inside route handlers and slug-scoped pages, not in the proxy — the proxy only does coarse "is this person any admin at all".) | Code | Smoke tests for both API and page routes; loop test for `/admin/forbidden`. |
| 13 | Create `src/app/sign-in/[[...sign-in]]/page.tsx` rendering `<SignIn />`. Catch-all bracket syntax exact. | Code | `/sign-in` renders Clerk UI locally. |
| 14 | Create `src/app/admin/forbidden/page.tsx` — explains "this email is not authorized; contact your reunion's super admin." Includes Clerk `<UserButton/>`. | Code | Page renders. |
| 15 | Refactor `src/app/admin/page.tsx` (top-level admin index) to a router using `getCurrentAdminContext()`:<br>• super admin → redirect to `/admin/super`<br>• reunion admin with exactly one reunion → redirect to `/admin/<that-slug>` (e.g., `/admin/phhs-1996` — note the slug uses a hyphen: `phhs-1996`, not `phhs1996`)<br>• reunion admin with multiple reunions → render a small picker page<br>• none → forbidden (already filtered by proxy, but defense-in-depth). | Code | Smoke test confirms each tier lands correctly. |
| 15a | **Add page-level scope check to `src/app/admin/[slug]/page.tsx`.** After resolving `reunion` from the slug, call `await requireReunionAdminPage(reunion.id)` so a reunion admin scoped to reunion A cannot load reunion B's dashboard simply by typing the URL. (The proxy only verifies "any admin"; this is the per-reunion gate at the page boundary.) Audit any sibling slug-scoped admin pages for the same omission and apply consistently. | Code | Smoke test: reunion-A admin browsing `/admin/<reunion-B-slug>` lands on `/admin/forbidden`. |
| 15b | **Fix pre-existing cross-tenant data leak in `src/app/admin/[slug]/page.tsx` (folded in from audit finding #3).** The profiles query joins `profiles` to `rsvps` without filtering by `rsvps.reunionId`. Today this is dormant (single reunion); the moment per-tenant admins land it leaks profiles from other reunions. Add `.where(eq(rsvps.reunionId, reunion.id))` to the profiles join (verify exact column name from `src/lib/db/schema.ts`). Read every other DB query in this file in the same pass and confirm each one is reunion-scoped — file the gaps in task 53 if more turn up. | Code | Manual SQL inspection; smoke test confirms profile counts match only the slug's reunion. |
| 16 | Create `src/app/admin/super/page.tsx` — super-admin landing. Lists all reunions (link to each `/admin/[slug]`), shows count of `reunion_admins`, link to `/admin/super/admins`. Calls `requireSuperAdminPage()` at top. | Code | Renders for super admin only. |
| 17 | Create `src/app/admin/super/admins/page.tsx` — super-admin-only table of `reunion_admins` rows grouped by reunion, with an "Add admin" form (reunion picker + email field) and a remove button per row. Calls `requireSuperAdminPage()`. | Code | Renders; forms submit to API in task 18. |
| 18 | Create `src/app/api/admin/super/admins/route.ts` (GET list / POST add / DELETE remove). Each method calls `requireSuperAdmin()`. POST validates email format, lowercases, inserts; handles unique-violation as "already an admin". DELETE removes by id. | Code | Curl from super admin works; from reunion admin returns 403. |
| 19 | Refactor `src/lib/site-mode.ts` `getAdminPreviewState`: replace `auth?.value === process.env.ADMIN_PASSWORD` with `await getCurrentAdminContext()`; `isAdmin = ctx ? (ctx.isSuper \|\| ctx.reunionIds.includes(reunion.id)) : false`. Function is already `async`, so the call site stays `await`ed (verified: it's always awaited). **Performance note:** because this function runs on public reunion pages, it must NOT call `currentUser()` per request — `getCurrentAdminContext()` reads from `sessionClaims.email` (per task 11). For signed-out visitors, `auth()` returns `{ userId: null }` immediately and the function short-circuits to `isAdmin = false` with zero DB or Backend API calls. Keep preview-cookie logic untouched. Update the JSDoc to note the auth migration date and the perf-sensitivity. | Code | `next build` (which runs type-check) passes; manual perf check confirms no Backend API calls on signed-out page loads. |
| 20 | Refactor `src/app/admin/layout.tsx`: drop the cookie check (proxy now handles unauth). Replace the `<form action="/api/admin/logout">` block with `<UserButton afterSignOutUrl="/" />`. Remove import of `AdminLogin`. | Code | Grep clean. |
| 20a | Refactor `src/components/admin-menu.tsx` (verified at line 163: it currently posts a sign-out form to `/api/admin/logout`, which task 32 deletes). Replace the form with Clerk's `<UserButton afterSignOutUrl="/" />`, or wrap the sign-out action with `useClerk().signOut()` if a custom UI is required. **Preserve `admin_preview_mode` cookie cleanup** — today the deleted `/api/admin/logout` route clears both `admin_auth` and `admin_preview_mode`. **`admin_preview_mode` is set as `httpOnly`, so client-side JS / Clerk session listeners CANNOT clear it.** The cleanup must run server-side. **Preferred approach:** add a `DELETE` (or `POST` action=clear) branch to `src/app/api/admin/preview-mode/route.ts` that clears the cookie, and have the menu call it via `fetch` immediately before invoking `signOut()`. Document in the file. (A Clerk session listener is NOT viable here because of the httpOnly attribute — call this out explicitly so future maintainers don't try.) | Code | Grep for `/api/admin/logout` is clean; smoke test confirms `admin_preview_mode` cookie is gone after sign-out. |
| 21 | Map the reunion context for each of the **10 admin API handlers** (after deleting login + logout). Read each handler to see whether reunionId comes from body, query, URL slug, or must be derived. Document the mapping inline as a comment block in `src/lib/admin-auth.ts`. **Verified mapping** (cross-checked against current handler source — confirmed there is no `memorialSubmissions` table; the table is `memorials` and it has its own `reunionId` column):<br>• `toggle-registration` → `reunionId` in request body.<br>• `memorial` → body provides `memorialId`; look up `memorials.reunionId` directly (DB lookup; `memorials` has its own `reunionId` column at schema.ts line 292 — no join needed).<br>• `sponsors` → body provides `sponsorId`; look up `sponsors.reunionId` directly (DB lookup; `sponsors.reunionId` at schema.ts line 227).<br>• `profiles` → `profiles` table has **no `reunionId` column** (verified schema.ts line 259+); reunion is derived by joining `profiles` → `rsvps` → `rsvps.reunionId` (same join shape as in `admin/[slug]/page.tsx`).<br>• `site-mode` → `reunionId` in request body.<br>• `preview-mode` → no reunion context; `requireAnyAdmin()` (just sets a UI cookie; per-page render does the per-reunion enforcement).<br>• `connect/create` → `reunionId` in request body.<br>• `connect/onboarding-link` → `reunionId` in request body.<br>• `connect/login-link` → `reunionId` in request body.<br>• `connect/status` → **`reunionId` in `req.nextUrl.searchParams` (query string), NOT body** (verified at route line 15). Helper still works because the route already extracts it; just pass to `requireReunionAdmin(reunionId)`.<br>Apply in tasks 22–31. | Audit | Mapping table written; each row cross-checked against the handler source. |
| 22 | Refactor `src/app/api/admin/toggle-registration/route.ts` — replace cookie check with `requireReunionAdmin(reunionId)` (reunionId from request body). Return 403 from helper as-is. | Code | Grep clean for that file. |
| 23 | Refactor `src/app/api/admin/memorial/route.ts` — body provides `memorialId`; look up `memorials.reunionId` directly (the `memorials` table owns `reunionId` — no separate `memorialSubmissions` table exists). Then `requireReunionAdmin(reunionId)`. | Code | Same. |
| 24 | Refactor `src/app/api/admin/preview-mode/route.ts` — uses `requireAnyAdmin()` (just toggling a UI cookie; preview-mode applies per-page render). Page render itself enforces per-reunion access. | Code | Same. |
| 25 | Refactor `src/app/api/admin/sponsors/route.ts` — body provides `sponsorId`; look up `sponsors.reunionId` directly, then `requireReunionAdmin(reunionId)`. | Code | Same. |
| 26 | Refactor `src/app/api/admin/site-mode/route.ts` — `requireReunionAdmin(reunionId)`. | Code | Same. |
| 27 | Refactor `src/app/api/admin/profiles/route.ts` — derive `reunionId` by joining `profiles` → `rsvps` (since `profiles` has no `reunionId` column), then `requireReunionAdmin(reunionId)`. If the route mutates a profile, scope the `WHERE` to `rsvps.reunionId = reunionId` to prevent cross-tenant write. | Code | Same. |
| 28 | Refactor `src/app/api/admin/connect/onboarding-link/route.ts` — `requireReunionAdmin(reunionId)`. | Code | Same. |
| 29 | Refactor `src/app/api/admin/connect/status/route.ts` — `reunionId` already extracted from `req.nextUrl.searchParams` (query string, not body); pass to `requireReunionAdmin(reunionId)`. | Code | Same. |
| 30 | Refactor `src/app/api/admin/connect/login-link/route.ts` — `requireReunionAdmin(reunionId)`. | Code | Same. |
| 31 | Refactor `src/app/api/admin/connect/create/route.ts` — `requireReunionAdmin(reunionId)`. | Code | Same. |
| 32 | Delete `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/components/admin-login.tsx`. **Confirm `src/components/admin-menu.tsx` no longer references `/api/admin/logout` (task 20a) before deleting the route file**, otherwise the menu's sign-out 404s. | Code | Files gone; `grep -r "admin-login\|ADMIN_PASSWORD\|admin_auth\b\|/api/admin/logout" src/` empty. |
| 33 | `npm run build` clean (type-check + Next build pass). | Audit | Exit 0. |
| 34 | Local smoke (signed-out): `curl http://localhost:3000/api/admin/sponsors` → 403; visiting `/admin` → redirects to `/sign-in`; `/api/webhooks/stripe` reachable. | Audit | Status codes match. |
| 35 | Local smoke (super admin): sign in with super-admin email; `/admin` redirects to `/admin/super`; can access `/admin/[any-slug]` and all admin APIs. | Audit | All admin actions return 2xx. |
| 36 | Local smoke (reunion admin for PHHS): sign in with a `reunion_admins` row email; `/admin` redirects to `/admin/phhs-1996` (verify exact slug from `reunions.slug` column); can act on PHHS APIs. Try to access `/admin/super` → forbidden. Try to call PHHS-scoped API with a different reunion's reunionId → 403. | Audit | Scope honored. |
| 37 | Local smoke (signed-in non-admin): **temporarily set Clerk dev sign-up to "Public" (or pre-create a user via Clerk dashboard) to test the app-level allowlist**, since with "Restricted" mode a non-allowlisted email cannot create an account in the first place. With a signed-in but non-allowlisted email: visiting `/admin` redirects to `/admin/forbidden` (no loop), and all admin APIs return 403 JSON. **Restore "Restricted" mode after the test.** | Audit | Forbidden enforced; no redirect loop. |
| 38 | Local smoke (preview mode): as PHHS reunion admin, toggle preview-mode cookie via `/api/admin/preview-mode`; banner appears; effective site mode follows cookie. | Audit | Preview banner renders. |
| 39 | Local smoke (sign-out): UserButton → Sign Out → lands at `/`; subsequent `/admin` → `/sign-in`. | Audit | Redirect to `/`. |
| 40 | Local smoke (Stripe webhook): Stripe CLI webhook to `/api/webhooks/stripe` while signed out — handler runs unchanged. | Audit | Payload processed. |
| 41 | Local smoke (super admin manage): visit `/admin/super/admins`; add a reunion admin via the form; verify row appears in DB; delete; verify removed. | Audit | CRUD works. |
| 42 | Commit work in atomic chunks for safe rollback granularity: (a) deps + provider + proxy.ts + sign-in route + helper + forbidden page, (b) schema + seed script, (c) site-mode + admin layout + admin-menu.tsx + admin index router, (d) super-admin pages + super-admin API, (e1) **slug-page scope guard + profiles cross-tenant fix** (task 15a + 15b — security-critical, isolated commit), (e2) toggle-registration + memorial + site-mode API refactors, (e3) sponsors + profiles + preview-mode API refactors, (e4) all four connect/* API refactors, (f) deletions (login route, logout route, admin-login component). Push branch to origin. | Code | `git push origin clerk-auth` succeeds; each commit independently revert-able. |
| 43 | **USER ACTION**: Create Clerk **production** application. Same provider config as dev — including Sign-up policy "Restricted" AND the session-token JWT template `{ "email": "{{user.primary_email_address}}" }` (mirrors task 2; without it, prod will fall back to `currentUser()` on every render and burn Backend API quota). Capture `pk_live_*` / `sk_live_*`. | User | Prod keys in hand; JWT template configured and verified. |
| 44 | **USER ACTION**: In Vercel project `phhs1996` → Settings → Environment Variables, add to **Preview** env: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (dev OK), `CLERK_SECRET_KEY` (dev), `SUPER_ADMIN_EMAILS`, the four `NEXT_PUBLIC_CLERK_*_URL` vars. | User | Vercel shows vars. |
| 45 | **USER ACTION**: Add same vars to **Production** env using `pk_live_*` / `sk_live_*`. | User | Vercel shows vars. |
| 46 | **USER ACTION**: Apply the schema change to **production** Turso DB using the project's existing workflow: temporarily point `.env.local` at the prod Turso URL/token, run `npm run db:push`, then `npm run db:seed-admins` with the committee list, then point `.env.local` back at dev. (This mirrors how prior schema changes were shipped — `db:push` not migrations.) | User | `reunion_admins` table exists in prod with seeded rows. |
| 47 | Open PR `clerk-auth` → `staging` on GitHub. Wait for Vercel preview deploy. | Code | PR created; preview URL live. |
| 48 | On preview URL, repeat smoke tests 34–41 against the staging Vercel preview. Fix anything broken before merging. | Audit | Preview smokes pass. |
| 49 | Merge `clerk-auth` → `staging`. Verify staging preview at `phhs1996-git-staging-hively.vercel.app`. | Code | Staging deploy green. |
| 50 | **USER ACTION**: Send committee email — "Admin sign-in changed. Visit https://www.parkhill1996reunion.com/sign-in. Use the email I added to the allowlist; you'll get a magic link or can use Google. The old password is gone. If you need access for a second reunion in future, ping me." | User | Email sent. |
| 51 | Merge `staging` → `main`. Vercel auto-deploys. Verify production sign-in with one super admin and one reunion admin. | Code | Prod deploy green; both sign-ins work. |
| 52 | After 24–48h of confirmed prod stability, **USER ACTION**: remove `ADMIN_PASSWORD` env var from Vercel `production` and `preview`. | User | Var gone. |
| 53 | Open follow-up GitHub issue tracking deferred items: super-admin email-invite flow, super-admin role moved to DB, audit log, MFA. | Code | Issue created. |

### Success Criteria
- `grep -rn "ADMIN_PASSWORD\|admin_auth\b\|/api/admin/logout\|/api/admin/login" src/` returns empty.
- All 10 surviving admin API handlers plus the new super-admin routes return 403 JSON for unauthenticated, non-admin, or wrong-reunion callers (curl-verified on preview deploy).
- `/admin/**` page routes redirect signed-out → `/sign-in` (with `returnBackUrl` preserved for deep links), non-admin → `/admin/forbidden`, super admin → `/admin/super`, reunion admin → their reunion's dashboard. `/admin/forbidden` itself does NOT redirect-loop.
- A reunion admin scoped to reunion A cannot load `/admin/<reunion-B-slug>` — the page-level scope guard (task 15a) redirects them to `/admin/forbidden`.
- Profiles query in `src/app/admin/[slug]/page.tsx` is reunion-scoped (no cross-tenant rows returned).
- `lib/site-mode.ts` `isAdmin` is true only for super admins or reunion-scoped admins for the reunion in scope; signed-out page renders make zero Clerk Backend API calls.
- `reunion_admins` table exists in prod with at least one seeded row for the PHHS reunion; super-admin UI can add/remove rows.
- Preview-mode cookie still works for admins, AND is cleared on sign-out (task 20a).
- Stripe webhook reachable (not gated).
- `npm run build` exits 0.
- Production deploy is green; both Ryan (super) and at least one committee member (reunion admin) can sign in.
- `ADMIN_PASSWORD` env var removed from Vercel after stability window.

### Dependencies
- 1 → 2 → 3 (user actions) → 4 → 5 (env) → 6 → 7 (db:push local) → 8 (seed local; task 9 removed/collapsed) → 10 (provider) → 11 (helper) → 12,13,14 (proxy + sign-in + forbidden; parallel) → 15 (admin index router) → 15a (slug-page scope guard) → 15b (profiles cross-tenant fix) → 16,17 (super-admin pages) → 18 (super-admin API) → 19 (site-mode) → 20 (admin layout) → 20a (admin-menu Clerk migration) → 21 (mapping) → 22–31 (per-route refactors; parallel-safe within the chunk) → 32 (deletions; depends on 20a being done so menu doesn't 404) → 33 (build) → 34–41 (local smokes) → 42 (push) → 43 (Clerk prod app) → 44,45 (Vercel envs) → 46 (prod db:push + seed) → 47 (PR) → 48 (preview smoke) → 49 (merge to staging) → 50 (committee comms) → 51 (merge to main) → 52 (env cleanup) → 53 (follow-up issue).

### Files Affected

**Created**
- `src/proxy.ts` (Next.js 16 name; **not** `middleware.ts`)
- `src/lib/admin-auth.ts`
- `src/lib/db/seed-admins.ts`
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/admin/forbidden/page.tsx`
- `src/app/admin/super/page.tsx`
- `src/app/admin/super/admins/page.tsx`
- `src/app/api/admin/super/admins/route.ts`

(All paths under `/Users/ryan/Development/product-journey/iguana-clerk-auth/`. **No `drizzle/` SQL file generated** — this project uses `db:push`.)

**Modified**
- `package.json` (new `db:seed-admins` script), `package-lock.json`
- `.env.example` (Clerk vars + `SUPER_ADMIN_EMAILS`)
- `src/app/layout.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/[slug]/page.tsx` (page-level scope guard + profiles cross-tenant fix)
- `src/components/admin-menu.tsx` (Clerk UserButton + preview-cookie cleanup move)
- `src/lib/db/schema.ts` (new `reunion_admins` table)
- `src/lib/site-mode.ts`
- `src/app/api/admin/toggle-registration/route.ts`
- `src/app/api/admin/memorial/route.ts`
- `src/app/api/admin/preview-mode/route.ts`
- `src/app/api/admin/sponsors/route.ts`
- `src/app/api/admin/site-mode/route.ts`
- `src/app/api/admin/profiles/route.ts`
- `src/app/api/admin/connect/onboarding-link/route.ts`
- `src/app/api/admin/connect/status/route.ts`
- `src/app/api/admin/connect/login-link/route.ts`
- `src/app/api/admin/connect/create/route.ts`

**Deleted**
- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/logout/route.ts`
- `src/components/admin-login.tsx`

### Risk Areas
- **Proxy file name.** Next.js 16 uses `src/proxy.ts`. A file at `src/middleware.ts` will silently not run on Next 16 — meaning the proxy never gates admin routes and all "this is gated" smoke tests would falsely pass at the proxy layer (route helpers would still 403, but the safety-in-depth layer is gone). This is the single highest-risk filename in the plan.
- **Proxy matcher.** Narrow matcher (`/admin(.*)`, `/api/admin(.*)`). Broadening it without re-auditing every public route (Stripe webhook included) risks gating something that must stay public. Documented as "narrow allowlist; never broaden without audit."
- **`/admin/forbidden` redirect loop.** `/admin/forbidden` matches the `/admin(.*)` pattern. Without the explicit "let `/admin/forbidden` through unconditionally" rule in `proxy.ts` (task 12), an unauthorized signed-in user redirected there would re-match the matcher, fail the admin check, and redirect again — infinite loop. Verified handled in task 12 logic step 1.
- **Reunion-context resolution per route.** Each of the 10 admin API handlers has its own way of knowing which reunion the request is about (body, query, URL, derived from a child entity by DB lookup). Profiles in particular has no `reunionId` column — must join through `rsvps`. Task 21 forces a deliberate per-route mapping pass with verified examples before the refactors.
- **Page-level scope is enforced separately from API-level scope.** The proxy only checks "is this person any admin"; per-reunion enforcement happens (a) inside route handlers via `requireReunionAdmin(reunionId)` for APIs and (b) inside the slug page via `requireReunionAdminPage(reunion.id)` (task 15a). Missing the page-side guard = reunion admin A can read reunion B's dashboard.
- **Pre-existing cross-tenant profiles leak (folded in).** `src/app/admin/[slug]/page.tsx` joins `profiles` to `rsvps` without `WHERE rsvps.reunionId = reunion.id`. Dormant today; exploitable the moment per-tenant admins land. Task 15b fixes; risk is that a sibling query in the same file has the same omission. Mitigation: read every DB query in the file in task 15b.
- **Empty `SUPER_ADMIN_EMAILS`** in any environment locks all super admins out. `requireSuperAdmin()` denies on empty/missing env (task 11 specifies `.filter(Boolean)` so a stray comma doesn't admit `""`). Mitigation: tasks 44–45 require setting it explicitly.
- **Seeding production `reunion_admins`.** If task 46 is skipped, no committee member can sign in even if Clerk auth succeeds. Mitigation: dependency chain blocks prod deploy on it.
- **Schema-vs-deploy ordering.** Production Turso must have the new table before the deploy lands. Task 46 sequences before task 47 (PR open) — must NOT reorder. Defense-in-depth runtime safety net: `isReunionAdmin()` is wrapped in try/catch (task 11) and fails closed if the table is missing, so a worst-case ordering reversal denies all reunion admins (recoverable) rather than throwing 500s site-wide.
- **Drizzle workflow.** Project uses `db:push`, not generated migrations. Plan honors this via task 7 (`npm run db:push`) and task 46 (same workflow against prod Turso). Introducing migrations would be its own scope expansion.
- **Admin lockout window.** The instant `main` deploys, every existing `admin_auth` cookie is invalid. Comms (task 50) before merge to main (task 51).
- **`isAdmin` async signature is already async, but the body changes from sync-cookie-compare to `await getCurrentAdminContext()`.** Every call site must remain `await`ed — verify in task 19 plus type-check during `next build` in task 33.
- **`currentUser()` perf cost on public pages.** `getAdminPreviewState()` runs on every reunion page render. Calling Clerk's Backend API there would add latency + rate-limit pressure. Task 11 specifies `sessionClaims.email` (set up as a Clerk session claim) instead, with `currentUser()` only as fallback.
- **`clerkUserId` backfill.** Originally specified as fire-and-forget. Task 11 now wraps in try/catch with `console.error` so unhandled rejections don't crash the request. Idempotent, so concurrent backfills race safely (same value).
- **Catch-all sign-in route bracket syntax.** `[[...sign-in]]` exact.
- **Clerk sign-up policy.** Plan uses **"Restricted"** (task 2) — defense in depth alongside the app-level allowlist. Note: smoke test 37 (signed-in non-admin) requires temporarily relaxing this in dev, then restoring (handled in task 37 description). In prod, "Restricted" stays on.
- **Self-lockout via super-admin UI.** A super admin removing their own super-admin status isn't possible (super is env-var-sourced), but a super admin removing another super admin's `reunion_admins` row could lock that person out of a reunion. Acceptable; it's a destructive action and surfaced clearly.

### Operator Recovery Runbook (lockout scenarios)
If sign-in fails for everyone after deploy, in priority order:
1. **Super admin lockout.** Symptom: `/admin` redirects to `/sign-in` after auth, then to `/admin/forbidden`. Cause: `SUPER_ADMIN_EMAILS` env var missing or stale on Vercel. Fix: Vercel → Settings → Environment Variables → add/correct `SUPER_ADMIN_EMAILS` → redeploy (Vercel re-renders server functions with new env).
2. **Reunion admin lockout.** Symptom: `/admin` lands on `/admin/forbidden` for a committee member. Cause: their email isn't in `reunion_admins` (typo, wrong case — though insert is lowercased; or row was never seeded). Fix: as super admin, add via `/admin/super/admins`. Or, if no super admin can get in, insert directly via Turso shell: `INSERT INTO reunion_admins (id, reunion_id, email, created_at) VALUES (lower(hex(randomblob(8))), '<reunion-id>', '<email>', strftime('%s','now') * 1000);`.
3. **Clerk sign-in itself failing.** Symptom: magic-link doesn't arrive. Diagnosis: Clerk dashboard → Users → individual user → Logs (sign-in attempts, email delivery status). Resolution: usually a typo in the user's email in `reunion_admins` — Clerk sent the link to the entered address, the operator typo'd the row.
4. **Schema missing in prod.** Symptom: 500s on every admin DB query. Cause: task 46 was skipped or run after deploy. Fix: run `npm run db:push` against prod Turso URL/token; redeploy.
5. **Stripe webhook gated.** Symptom: payments stop processing; `/api/webhooks/stripe` returns 403. Cause: proxy matcher accidentally widened. Fix: revert to narrow matcher (`/admin(.*)`, `/api/admin(.*)`).

---

## Step 3: Plan Audit Findings

```
### Plan Audit Findings (resolved into v2 above)

- [BLOCKER -> RESOLVED] Original v1 had a single env-var allowlist (CLERK_ADMIN_EMAILS). User requirement is two tiers (super + per-tenant). v2 splits into env-var super admins + DB-table reunion admins.
- [BLOCKER -> RESOLVED] v1 had no schema change. v2 adds `reunion_admins` table (task 6), migration (task 7), seed (task 9), and prod migration step (task 46).
- [BLOCKER -> RESOLVED] v1's `requireAdmin()` was scope-blind. v2 splits into requireSuperAdmin / requireReunionAdmin / requireAnyAdmin and forces per-route mapping (task 21) before refactors.
- [WARNING -> RESOLVED] API routes must return JSON 403, not redirect. v2's middleware (task 12) and helpers (task 11) split page-vs-API behavior explicitly.
- [WARNING -> RESOLVED] Non-admin API routes were not enumerated. v2's task 12 enumerates the explicit excludes.
- [WARNING -> RESOLVED] Vercel env vars must precede preview deploy. v2 sequences tasks 44–46 before 47.
- [WARNING -> RESOLVED] No comms plan. v2 adds task 50 before merge to main.
- [WARNING -> RESOLVED] Admin layout still posts to /api/admin/logout. v2 task 20 replaces with UserButton.
- [WARNING -> RESOLVED] User actions for Clerk dashboard, Vercel envs, prod migration, prod seed, committee email, post-rollout cleanup — all explicitly labeled USER ACTION.
- [WARNING -> RESOLVED] Top-level /admin index no longer makes sense as a single dashboard once roles exist. v2 task 15 turns it into a router.
- [WARNING -> RESOLVED] Super admins need a way to manage reunion admins. v2 adds tasks 16–18 (super landing page + admins management page + API).
- [NIT -> RESOLVED] Tasks 22–31 stay granular for verifiability (one task per route file).
- [NIT] First-sign-in `clerkUserId` backfill is a fire-and-forget side effect in `getCurrentAdminContext` — keeps the helper API clean while ensuring rows get linked over time.

### Residual Risk
- **Manual Clerk dashboard config drift** between dev and prod apps (provider settings, redirect URLs, allowed origins). Mitigated by task 43 mirroring task 2 settings.
- **Reunion-context inference per route**: task 21 is a thinking task; if the engineer skips it, route-level scope checks could be wrong. Mitigation is the explicit comment in admin-auth.ts mapping each route → its reunionId source.
- **Production seed accuracy**: if the committee email list provided in task 3 is stale/wrong, real committee members get locked out at first sign-in attempt. Super admin can fix via /admin/super/admins post-deploy, but it's a friction moment.
- **Single-tenant assumptions in existing UI**: some admin pages may currently fetch "the only reunion" without slug parameterization. The role refactor doesn't fix that; if a second reunion ever lands, those pages need a separate audit. Captured in task 53.
- **Super-admin promotion**: super admins live in env var, so changing the super-admin set requires a Vercel env var edit + redeploy. Acceptable for v1 (small, stable set). Promotion to DB column is in task 53's follow-up.
- **DB migration vs. deploy ordering on Vercel**: Vercel deploys are atomic but the Turso migration isn't tied to the deploy. If task 46 (prod migration) is run AFTER deploy, the deploy 500s on first admin DB query. Task 46 explicitly sequences before task 47.
- **First-sign-in backfill race**: if two super admins sign in simultaneously and both trigger the clerkUserId backfill, two UPDATE queries race. Idempotent (same user, same value); acceptable.
- **Stripe webhook signature verification** is independent of this auth change but the matcher must keep `/api/webhooks/*` un-gated. Verified in task 40.
- **Magic-link delivery timing**: Clerk emails generally deliver in under 30s; if a committee member doesn't receive one, the diagnostic flow goes through Clerk dashboard logs. Make sure a super admin knows where to look (Clerk dashboard → Users → individual user logs).
```

---

## Step 6: Codex Convergence — Iteration 1 Findings (all resolved into v3 above)

```
Codex review of v2 surfaced 17 findings. All applied to the plan in this revision (v3).

[BLOCKER -> RESOLVED] #1 Next.js 16 uses proxy.ts not middleware.ts
  → Plan now creates src/proxy.ts (not middleware.ts). Risk Areas calls out the filename trap.

[BLOCKER -> RESOLVED] #2 No reunion-scope enforcement on /admin/[slug]/page.tsx
  → New task 15a adds requireReunionAdminPage(reunion.id) after slug resolution.

[BLOCKER -> RESOLVED, FOLDED IN] #3 Profiles join doesn't filter by rsvps.reunionId
  → User decision: FOLD IN. New task 15b adds .where(eq(rsvps.reunionId, reunion.id))
    plus a scope-audit pass over every other DB query in src/app/admin/[slug]/page.tsx.

[BLOCKER -> RESOLVED] #4 /admin/forbidden redirect loop
  → Task 12 logic step 1 explicitly lets /admin/forbidden through unconditionally.

[BLOCKER -> RESOLVED] #5 Drizzle workflow drift (push vs migrate)
  → Plan switched to project's existing db:push workflow throughout (tasks 7, 46).
    No drizzle/ migration files generated. Files Affected list updated.

[WARNING -> RESOLVED] #6 Matcher list internally inconsistent + misses /api/memorial/review
  → Task 12 simplified: narrow matcher only; no exclusion list (public routes simply don't match).
    Documented as "narrow allowlist; never broaden without audit."

[WARNING -> RESOLVED] #7 redirectToSignIn returnBackUrl for deep links
  → Task 11 page-redirect helpers now use redirectToSignIn({ returnBackUrl }).
    Task 12 proxy logic does the same for unsigned requests.

[WARNING -> RESOLVED] #8 currentUser() perf cost on public pages
  → Task 11 specifies sessionClaims.email (with currentUser() as fallback only).
    Task 19 adds JSDoc note about perf-sensitivity in getAdminPreviewState().

[WARNING -> RESOLVED] #9 Reunion-context resolution: profiles needs join
  → Task 21 now contains an explicit per-route mapping table including the profiles join shape.
    Task 27 (profiles refactor) calls out the join requirement.

[WARNING -> RESOLVED] #10 Logout deletion + admin-menu still posts to deleted route
  → New task 20a refactors src/components/admin-menu.tsx to use Clerk UserButton +
    moves admin_preview_mode cookie cleanup. Task 32 now blocks on 20a.

[WARNING -> RESOLVED] #11 Sign-up disabled vs forbidden flow contradiction
  → Task 2 specifies "Restricted" sign-up policy (not fully off). Task 37 documents
    temporarily relaxing in dev to test the allowlist, then restoring.

[WARNING -> RESOLVED] #12 SUPER_ADMIN_EMAILS empty-string handling
  → Task 11 spec now requires .map(s => s.trim().toLowerCase()).filter(Boolean).

[WARNING -> RESOLVED] #13 clerkUserId backfill fire-and-forget
  → Task 11 spec now requires try/catch + console.error around backfill UPDATE.

[WARNING -> RESOLVED] #14 Migration sequencing has no runtime safety net
  → Task 11 spec wraps isReunionAdmin DB query in try/catch with fail-closed return.

[WARNING -> RESOLVED] #15 Lockout recovery not documented
  → New "Operator Recovery Runbook" subsection under Risk Areas covers 5 lockout scenarios.

[WARNING -> RESOLVED] #16 Commit chunk (e) too large for safe rollback
  → Task 42 splits chunk (e) into e1 (security-critical: 15a + 15b), e2 (3 routes), e3 (3 routes), e4 (4 connect routes).

[NIT -> RESOLVED] #17 Drift errors
  → Updated throughout: .env.example (not .env.local.example);
    slug is phhs-1996 (not phhs1996); 10 admin handlers (not 11) after deletions.
```

---

## Convergence Status
**Iteration 1 (PAUSE):** 17 findings raised; user decision needed on finding #3 (fold in vs separate).
**Iteration 1 resolution:** User chose FOLD IN for #3. All 17 findings applied to plan as v3.
**Iteration 2 (NOT-CONVERGED):** Codex confirmed 14 of 17 findings as AGREE-FIXED, 3 as AGREE-FIXED-WITH-CAVEAT (#8 sessionClaims config, #10 admin_preview_mode httpOnly, #9 mapping table errors). Caveats applied:
- Task 2 + task 43: USER ACTION now includes Clerk JWT-template configuration `{ "email": "{{user.primary_email_address}}" }` so `sessionClaims.email` actually resolves.
- Task 20a: explicitly preferred server-side cookie clear via `/api/admin/preview-mode` DELETE branch; called out that Clerk session listener is NOT viable for an httpOnly cookie.
- Task 21: mapping table corrected — `memorials` (not `memorialSubmissions`) owns `reunionId` directly; `connect/status` reads `reunionId` from query string; `sponsors`/`memorials` are direct lookups not joins. Tasks 23, 25, 29 updated to match.
**Iteration 3 (CONVERGED):** Codex confirmed all 3 caveats correctly addressed. No remaining BLOCKERs or WARNINGs. Plan is ready for execution.
