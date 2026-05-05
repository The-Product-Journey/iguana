# Brand assets — source of record

Canonical copies of every Glad You Made It brand asset. The app does not
read from this folder at runtime — when an asset is needed in code, copy
it into `public/brand/` (or `src/app/` for `favicon.ico`) and reference
it from there. This folder is the registry; `public/` is the deploy.

## Contents

### `BRAND.md`
The brand application brief from the designer (May 2026). Type, color,
logo usage, button styles, etc.

### `wordmark/` — designer-supplied
Three SVG variants of the horizontal "GLAD YOU Made It!" wordmark:

- `glad-you-made-it-wordmark.svg` — default for light surfaces
- `glad-you-made-it-wordmark-dark.svg` — for forest / dark surfaces
- `glad-you-made-it-wordmark-adaptive.svg` — `currentColor` variant; inherits `color` from parent

PNG fallbacks (1680px wide) for non-SVG contexts.

### `tag-icon/` — designer-supplied
The name-tag mark rendered as an icon (favicon / app icon / square avatar).
SVG, ICO, and PNG sizes 16 / 32 / 48 / 64 / 128 / 180 / 256 / 512.

### `name-tag/` — copied from prior batch (designer did not include in latest delivery)
Full name-tag lockup, PNG only. SVG versions (`glad-you-made-it-name-tag.svg`
and `glad-you-made-it-name-tag-square.svg`) are referenced by `BRAND.md`
but were **not** delivered — request from designer if/when needed.

- `glad-you-made-it-name-tag.png`
- `glad-you-made-it-name-tag-square.png`

### `favicons-current/` — currently deployed favicons
Snapshot of the favicons live in production today (older mark — a simple
persimmon block, not the new tag-icon). Kept here so we can trace what's
served. The new `tag-icon/` set is intended to supersede these once we
swap them in.

- `favicon.svg` (currently at `public/favicon.svg`)
- `favicon.ico` (currently at `src/app/favicon.ico`)
- `apple-touch-icon.png` (currently at `public/apple-touch-icon.png`)
- `icon-192.png`, `icon-512.png` (currently at `public/`)

## Provenance summary

| Subfolder | Source |
|---|---|
| `BRAND.md` | Designer, May 2026 |
| `wordmark/` | Designer, May 2026 |
| `tag-icon/` | Designer, May 2026 |
| `name-tag/` | Copied from `public/brand/` — earlier delivery, no SVGs yet |
| `favicons-current/` | Copied from `public/` and `src/app/` — current production favicons |
