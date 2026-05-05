# Glad You Made It — Brand Application Brief

This document specifies the brand system for the Glad You Made It app and its surfaces. Apply throughout the app and any external collateral. The favicon has been applied; this brief covers everything else.

The goal is a coherent, warm, confident brand presence. Existing functional layouts should largely stay; what changes is type, color, and brand chrome.

---

## 1. Brand colors

```css
:root {
  /* Brand primary — confident, grounded, dominant surface color */
  --color-forest: #2B5747;
  --color-forest-deep: #1E3F33;   /* hover/active state */
  --color-forest-soft: #3D6A59;   /* lighter forest interactions */

  /* Brand accent — warm, used sparingly */
  --color-persimmon: #F2A065;
  --color-persimmon-deep: #E08A4D;

  /* Brand neutral — warm cream, used for the name tag card field */
  --color-cream: #F4ECDA;

  /* Functional neutrals */
  --color-bg: #FFFFFF;
  --color-bg-subtle: #FAF7F2;     /* slight cream tint for section backgrounds */
  --color-surface: #FFFFFF;
  --color-border: #E8E4DD;
  --color-border-strong: #C9C2B5;

  /* Text */
  --color-text: #1F1B16;          /* near-black with warm undertone */
  --color-text-muted: #6B6359;
  --color-text-subtle: #8E8579;
  --color-text-on-forest: #F4ECDA;
  --color-text-on-persimmon: #2B5747;
}
```

**Rules of use**
- **Forest is the primary brand color.** Use for primary buttons, active states, brand surfaces, links, and any "this is the brand" moment.
- **Persimmon is the accent.** Use for the favicon mark, focus rings, status pulse indicators, the wordmark exclamation, and rare high-emphasis highlights. **Never** use persimmon for primary action buttons, full-page backgrounds, or large fills.
- **Cream is the warm neutral** for the name tag card field and occasional soft section backgrounds. Do not use cream as the app's main background — white stays primary for readability.
- **White stays the workspace canvas.** Brand warmth comes from type and accents, not from tinting every surface.

---

## 2. Typography

Three typefaces, each in a clearly defined role.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Caveat:wght@700&family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&display=swap" rel="stylesheet">
```

```css
:root {
  --font-sans: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
  --font-script: 'Caveat', cursive;     /* logo-only, do NOT use in app UI */
  --font-serif: 'Fraunces', Georgia, serif; /* limited marketing-voice use only */
}
```

**Roles**

- **Bricolage Grotesque** is the app's primary typeface. Use for all body text, navigation, buttons, form fields, headings, table content, and labels. Default weight 400–500 for body, 600–700 for headings, 800 for the wordmark's "GLAD YOU" block.
- **Caveat is logo-only.** It appears inside the name tag and inside the wordmark, and **nowhere else**. Do not use it for decorative headers, "handwritten" UI elements, or any other context.
- **Fraunces** has a limited role. Use it sparingly for marketing-voice moments — empty-state warmth, hero phrases on the marketing site, occasional soft headlines. **Not for the wordmark anymore** (the wordmark uses Caveat). If unsure whether a heading should be in Fraunces or Bricolage, default to Bricolage.

---

## 3. Logo and asset usage

Asset files (place in `/public/brand/`):

| File | Use |
|---|---|
| `favicon.svg` / `favicon.ico` / `favicon-32.png` / `favicon-180.png` | Browser tab, app icon, square avatars (already applied) |
| `glad-you-made-it-wordmark.svg` | **Default wordmark for light surfaces** (white, cream) |
| `glad-you-made-it-wordmark-dark.svg` | Wordmark for dark surfaces (forest) |
| `glad-you-made-it-wordmark-adaptive.svg` | currentColor variant — text and outline both inherit `color` from CSS, single file works on any surface |
| `glad-you-made-it-wordmark.png` / `*-dark.png` | Raster fallbacks (1680px wide) for contexts that don't support SVG |
| `glad-you-made-it-name-tag.svg` | Full name tag lockup, 3:2 ratio, for marketing surfaces and hero areas |
| `glad-you-made-it-name-tag-square.svg` / `.png` | Name tag centered in a square frame, for square slots like Clerk's logo |

### The wordmark structure

The wordmark is a horizontal lockup of two voices:
- A **persimmon block** containing "GLAD YOU" in Bricolage Grotesque ExtraBold, cream, letter-spaced 2.6.
- A **transparent body** containing "Made It" in Caveat Bold, with a persimmon "!" — text color adapts to surface.
- The whole thing is wrapped in a thin outline that adapts to surface (dark on light, light on dark).

The wordmark and the name tag share the same typographic DNA — same two voices, just different layouts. They are deliberately related, not the same.

### Header lockup (top global nav)

Use the wordmark SVG. Two acceptable patterns:

**Pattern A (recommended for most surfaces): just the wordmark.**
```jsx
<header className="flex items-center px-6 py-4 border-b border-[var(--color-border)]">
  <a href="/" aria-label="Glad You Made It home">
    <img
      src="/brand/glad-you-made-it-wordmark.svg"
      alt="Glad You Made It"
      className="h-9 w-auto"
    />
  </a>
</header>
```

**Pattern B: favicon mark + wordmark side-by-side.**
Use this when the layout benefits from a small square element anchoring the left edge (e.g., dense app headers with many other elements).
```jsx
<header className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)]">
  <img src="/favicon.svg" alt="" className="h-9 w-9" />
  <img
    src="/brand/glad-you-made-it-wordmark.svg"
    alt="Glad You Made It"
    className="h-8 w-auto"
  />
</header>
```

**Do not** render "Glad You Made It" as plain system-font text anywhere. The wordmark SVG is the only correct rendering of the brand name.

### Choosing wordmark variant by surface

- White or near-white background → `glad-you-made-it-wordmark.svg` (light, default)
- Forest (`#2B5747`) background → `glad-you-made-it-wordmark-dark.svg`
- Other branded surfaces, or to keep a single asset → `glad-you-made-it-wordmark-adaptive.svg`, set `color: var(--color-forest)` or `color: var(--color-cream)` on the parent

### Sizing

The wordmark is approximately 7.2:1 ratio (433 × 60 SVG units). Use these defaults; tweak only when justified:

| Context | Wordmark height |
|---|---|
| App header (compact) | 24–28px |
| App header (default) | 32–36px |
| Marketing site nav | 36–44px |
| Footer | 22–26px |

Because the wordmark is genuinely horizontal, prefer setting `height` and letting `width` auto-derive (`height: 32px; width: auto`).

---

## 4. Specific changes for the current Sites page

Based on the current screenshot:

- **Header**: replace the small persimmon mark + plain "Glad You Made It" text with the wordmark SVG (Pattern A). White background, 1px bottom border in `--color-border`, wordmark sized to ~36px tall.
- **"Sites" page heading**: Bricolage Grotesque semibold (600) at 28–32px, color `--color-text`. Skip Fraunces here — the page is utility, not marketing.
- **"+ Create site" tile**:
  - Border: 1.5px dashed `--color-border-strong`
  - Hover: border becomes solid `--color-forest`, background becomes `--color-bg-subtle`, transition 150ms
  - Plus icon and text: `--color-text-muted` default, `--color-forest` on hover
  - Text: "Create site" in Bricolage Grotesque medium (500), 16px
- **Existing site cards**:
  - The current saturated-red top band reads as tenant-derived branding. Soften the default to `--color-cream` and let tenant brand color override only if explicitly configured (this is a real product decision — see Section 6).
  - Card border: 1px solid `--color-border`, 12px radius
  - Hover: subtle shadow lift, border slightly darkens
  - Site name: Bricolage Grotesque semibold (600), 18px, `--color-text`
  - "Production" pill: keep green but use a forest-tinted hue (`#2D7A5F` or similar) to harmonize
  - "Go to site →" link: `--color-forest`, hover `--color-forest-deep`, arrow nudges right 2–4px on hover

---

## 5. General principles (apply across the app)

### Buttons

- **Primary**: `background: var(--color-forest); color: var(--color-text-on-forest);` Hover: `background: var(--color-forest-deep);` Border-radius: 8px. Padding: 10px 16px (medium). Font: Bricolage Grotesque medium (500), 14–15px.
- **Secondary**: `background: transparent; color: var(--color-forest); border: 1.5px solid var(--color-forest);` Hover: `background: var(--color-bg-subtle);`
- **Tertiary/ghost**: text-only, `color: var(--color-forest)`, hover: `background: var(--color-bg-subtle)`
- **Destructive**: deep red (`#B23A2A` or similar — not persimmon). Persimmon is reserved for the brand accent and must never signal danger.

### Focus states

Every focusable element gets a 2px persimmon outline with 2px offset:
```css
*:focus-visible {
  outline: 2px solid var(--color-persimmon);
  outline-offset: 2px;
  border-radius: inherit;
}
```

### Links

In body content (not button-styled): `color: var(--color-forest);` underline on hover. Visited links keep the same color.

### Form inputs

1.5px border in `--color-border-strong`, 8px radius, 10px 12px padding, white background. On focus, border becomes `--color-forest` and the persimmon focus ring appears.

### Status colors

- **Success**: forest green (`--color-forest`) with a lighter background tint
- **Warning**: amber that harmonizes with persimmon (`#D89535`)
- **Error**: deep red (`#B23A2A`)
- **Info**: forest with a subtle background

### Empty states

This is one of the few places to use Fraunces italic for warmth. Example:

> *Glad you made it.* Let's set up your first site.

— with "Glad you made it." in Fraunces italic 300 (24–28px) and the second sentence in Bricolage Grotesque regular. Use this pattern sparingly so the warm-voice moments stay rare and intentional.

### Spacing & radius

- Border radius: 8px standard, 12px for cards, 14px for the wordmark, 24px for the name tag (encoded in the SVG)
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
- Page padding: 24px on mobile, 48px on desktop

---

## 6. Open product decisions worth resolving

The brief leaves a few things deliberately open because they are product decisions, not brand decisions. Surface them rather than guessing:

1. **Tenant-driven theming.** How much of each tenant's brand should bleed into the workspace shell? The current Park Hill site card has a saturated red band that feels tenant-derived. The default in this brief is to soften that to cream and only show tenant color when explicitly configured — but this trades distinctiveness for consistency. Make a deliberate call.
2. **Dark mode.** This brief assumes light surfaces by default. The wordmark and name tag both have dark-surface variants ready, but a comprehensive dark mode (background tokens, surface tokens, etc.) hasn't been specified. Add when needed.

---

## 7. Things to avoid

- **No new color values** outside the palette above. Surface the question rather than inventing one.
- **Caveat is logo-only.** The handwritten voice belongs only to the wordmark and the name tag.
- **Persimmon is never a primary fill.** No persimmon buttons, no persimmon hero backgrounds, no persimmon body color. It's an accent.
- **No tinted app backgrounds.** White stays the workspace canvas; warmth comes from type, accents, and occasional `--color-bg-subtle` sections.
- **No system-font "Glad You Made It" text.** The wordmark SVG is the only correct rendering of the brand name.
- **No decorative gradients, glassmorphism, or heavy shadows.** The brand reads as crafted/editorial; those effects fight that.

---

## 8. Order of operations

1. Add the brand assets to `/public/brand/`.
2. Establish the CSS custom properties from Section 1 in the global stylesheet.
3. Load the three Google Fonts and define the type stack variables.
4. Replace the global header per Section 3.
5. Apply the Sites page changes per Section 4.
6. Sweep the rest of the app and apply the general principles in Section 5.
7. Surface any pages or components where the brief is unclear — better to ask than to invent.
