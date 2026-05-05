# PLAN: Tenant Brand Color Extraction

> Status: design / not yet implemented. Created May 2026.

This document captures the analysis and implementation plan for letting
tenants configure their reunion site's primary brand color (replacing
the hardcoded PHHS Park Hill red on `/[slug]/*` pages).

## Problem statement

Today every public reunion site renders in PHHS Park Hill red — a
hardcoded `red-700` / `red-800` / `red-900` palette spread across the
tenant-facing pages and components. Adding a second tenant means either
forking the components or making the brand color configurable.

Goal: a tenant supplies a primary brand color via the admin UI; the
public reunion site renders in that color; existing PHHS reunions
continue to look identical (no visual regression).

Out of scope for this plan:
- Tenant typography customization (everyone gets the platform fonts)
- Per-tenant logos in the public reunion nav (separate feature)
- Per-tenant favicons (already shipped — see `reunions.faviconUrl`)
- Status colors (paid / pending / failed). These stay platform-managed
  so a "paid" pill always reads as success regardless of brand.

## Audit (numbers from `grep red- src/app/[slug] src/components/<tenant>`)

**162 red references** across tenant pages + components, using **10
distinct shades**:

| Count | Shade | Most common use |
|---|---|---|
| 94 | `red-500` | Focus rings on every form input + button |
| 79 | `red-700` | Primary brand red — buttons, links, badges |
| 50 | `red-800` | Hover states, deep gradient stops |
| 22 | `red-50` | Light tints — badge backgrounds, hover bg |
| 12 | `red-200` | Soft borders |
| 10 | `red-100` | Light tints |
| 8  | `red-900` | Gradient endpoints |
| 6  | `red-300` | Light text on dark gradient (tease landing's "Admin login") |
| 5  | `red-600` | Occasional |
| 1  | `red-950` | Deepest gradient endpoint |

## Semantic mapping

The 10 shades collapse to a small semantic palette:

| Token | Maps from | Use |
|---|---|---|
| `--tenant-primary` | red-700 + red-600 | Buttons, links, badges, brand identity |
| `--tenant-primary-deep` | red-800 + red-900 | Hover states, deep gradient stops |
| `--tenant-darkest` | red-950 | Gradient endpoints |
| `--tenant-tint` | red-50 + red-100 | Light hover bgs, soft badges |
| `--tenant-border-soft` | red-200 + red-300 | Light borders, subtle accents |
| `--tenant-on-dark` | red-300 (specifically light text on dark surfaces) | Tease landing only |
| `--tenant-focus` | red-500 (focus rings) | Could just reuse `--tenant-primary` — visual difference is negligible |

Realistic minimum: **5 tokens** (primary, primary-deep, darkest, tint,
border-soft). Focus and on-dark can derive from these.

## Two implementation models

### Option A — One primary color, derive shades via `color-mix()`

Tenant supplies one hex value. App uses `color-mix(in oklch, ...)` in
CSS to compute the deep, darker, tint, and border variants.

```css
/* Set per-tenant via inline style on body or a CSS-in-JS layer */
--tenant-primary: #B91C1C;

/* Derived in globals.css */
--tenant-primary-deep: color-mix(in oklch, var(--tenant-primary) 85%, black);
--tenant-darkest: color-mix(in oklch, var(--tenant-primary) 60%, black);
--tenant-tint: color-mix(in oklch, var(--tenant-primary) 10%, white);
--tenant-border-soft: color-mix(in oklch, var(--tenant-primary) 30%, white);
```

**Pros:** One-color UX. Browser support is fine (Safari 15.4+, Chrome
111+, Firefox 113+ all support `color-mix()` and OKLCH).

**Cons:** Auto-derived tints might not pixel-match a tenant's exact
brand spec. Acceptable for ~90% of cases. Tenants with strict brand
guidelines can upgrade to Option B later.

### Option B — Tenant configures the full palette (3–5 colors)

Tenant supplies primary + deep + tint (or all five tokens). More
control, more work for the tenant.

**Pros:** Pixel-perfect brand matching.

**Cons:** Asks tenants to think about color theory. Most won't bother
and will pick something visually inconsistent.

### Recommendation

Ship **Option A** first. Design the CSS variable system so a future
Option B (multi-color) is just adding more inputs to the admin form —
same components, same tokens, different sources.

## Edge cases to handle

### 1. Unreadable colors (low contrast vs white background)

If admin picks `#FFEEEE` (very light pink), buttons/text using that as
primary would be invisible on white background.

**Decision: validate with a warning, don't block.**

- On the admin form, compute WCAG AA contrast ratio between the
  selected color and white (the default body background)
- If contrast < 4.5:1 (WCAG AA for body text), show a yellow warning:
  > "This color may be hard to read on white backgrounds. Visitors
  > may have trouble seeing buttons and links."
- Don't prevent saving. It's the tenant's brand and they may have
  reasons we can't anticipate.
- Same check on the dark-side (verify `--tenant-on-dark` text is
  legible against `--tenant-darkest` background — though this is
  derived, so usually fine if primary is mid-tone).

Keep this as a soft warning. Hard validation would lock out perfectly
valid edge cases (a tenant with neon brand identity, etc.).

### 2. Variable backgrounds — light AND dark surfaces

The public reunion site uses both:
- **Light surfaces** (most pages) — primary needs sufficient contrast
  against white
- **Dark gradient hero** (tease landing) — light text on a deep
  primary-derived gradient

The semantic token system handles this:
- Light surfaces use `--tenant-primary` (typically dark enough on white)
- Dark surfaces use `--tenant-darkest` as background and
  `--tenant-on-dark` (a very light derived shade) for text

Both derive from the single tenant primary via `color-mix()`. As long
as primary is not pathologically light, both ends of the spectrum
remain legible.

Pathological case: tenant picks `#FFFFAA` (light yellow). Derived
`--tenant-darkest` would be a dim olive — fine on dark surface. But
primary on white background is invisible. The contrast warning above
catches this.

### 3. Existing PHHS data — no regression

Default tenant brand color = current PHHS red (`#B91C1C` ≈ `red-700`).

Migration strategy:
- DB migration adds `brand_color` column with default `'#B91C1C'`
- Existing PHHS row picks up the default automatically
- Public site renders identically to today

### 4. The 3-stop gradient on tease landing

`from-red-800 via-red-900 to-red-950` becomes
`from-tenant-primary-deep via-tenant-darkest to-tenant-darkest` (or
similar). Eyeball each tenant brand because dramatic gradients are
where derived tints sometimes look off.

### 5. Status colors stay platform-managed

`bg-success`, `bg-warning`, `bg-danger` (defined in the platform
brand) keep their platform values regardless of tenant brand. A "paid"
pill always reads as success-green; this isn't tenant-configurable.
Same logic for the persimmon focus ring on platform pages.

### 6. The PHHS-red literals scattered across pages

Some pages have inline color choices that don't follow the
shared-component model perfectly (e.g. `<Link>` with `text-red-700`
hardcoded next to body text). Each needs visiting individually — sed
can do most of it but contextual review is necessary.

## Implementation plan (when we do this)

### Phase 1 — Foundation (~1 hour)

1. Add `brand_color` column to `reunions` (text, default `'#B91C1C'`).
2. Add semantic CSS variables in `globals.css`:
   - `--tenant-primary`, `--tenant-primary-deep`, `--tenant-darkest`,
     `--tenant-tint`, `--tenant-border-soft`, `--tenant-on-dark`
   - All derived from `--tenant-primary` via `color-mix()`
3. Inject `--tenant-primary` into the body element of `[slug]/layout.tsx`
   based on `reunion.brandColor`.

### Phase 2 — Refactor (~2-3 hours)

4. Sweep all tenant pages and components, replacing red Tailwind classes
   with semantic tokens:
   - `red-700` → `bg-tenant-primary` / `text-tenant-primary` / `border-tenant-primary`
   - `red-800` → `bg-tenant-primary-deep` / `hover:bg-tenant-primary-deep`
   - `red-50` → `bg-tenant-tint`
   - etc.
5. The 3-stop gradient on tease landing gets manual treatment.
6. Focus rings: `focus:ring-red-500` → `focus:ring-tenant-primary`.

### Phase 3 — Admin UI (~30-45 min)

7. Add "Brand color" field to the existing Site Customization section
   in `/admin/[slug]`. Color picker (HTML5 `<input type="color">` is
   fine) + hex text input.
8. Live preview swatch: shows a button styled with the chosen color.
9. Contrast warning: if contrast vs white is too low, show a
   non-blocking yellow note.
10. Save endpoint extends `/api/admin/reunion-customization` to accept
    `brandColor`.

### Phase 4 — Verification (~30 min)

11. Test on staging across:
    - Tease mode (gradient hero)
    - Pre-register mode (form-heavy)
    - Open mode (CTAs everywhere)
12. Test contrast warning with a too-light color.
13. Verify PHHS reunion looks identical to before the rebrand.

### Total estimate

**~4-5 hours focused work.**

## Open questions for when we revisit

1. **Should tenants be able to upload an SVG logo** that replaces the
   plain text reunion name in the public site nav? Out of scope here
   but related — would compose with this brand color system.
2. **Should the AdminMenu and AdminPreviewBanner adopt the tenant
   brand color too?** Today they stay PHHS red (admin chrome). If we
   make this configurable, the admin chrome could match the tenant
   brand. Might be more cohesive; might be more confusing.
3. **Multi-color Option B as a future upgrade?** If we hear that
   single-color derivation isn't matching a tenant's brand, we add
   per-shade configuration. The semantic token system means components
   don't change — just the source of the values does.
4. **Should we curate a set of preset palettes** in addition to
   free-form hex input? Picking from "Crimson", "Royal", "Forest",
   "Burgundy" might be friendlier than asking tenants to pick a hex.
   Possible Phase 2 enhancement.

## Risks (rank-ordered)

1. **Color-mix derived tints look wrong for some hues.** Test with a
   handful of brand colors (red, blue, green, dark teal, gold) before
   declaring victory.
2. **Tenants pick low-contrast colors and complain** when their site
   "looks broken." Mitigated by the contrast warning, but not eliminated.
3. **Gradient endpoints on the tease hero look muddy** for non-red
   primaries. Some manual tuning may be needed for the gradient stops.
4. **Performance**: the entire `[slug]/layout.tsx` becomes
   non-statically-renderable because it injects per-tenant inline
   styles. Negligible impact at our scale, but worth noting.

## What this plan does NOT cover

- Tenant logo / wordmark customization (separate feature)
- Tenant typography customization (out of scope, low demand)
- Custom domain configuration (already shipped — see
  `reunions.customDomain`)
- Per-tenant favicon (already shipped — see `reunions.faviconUrl`)
