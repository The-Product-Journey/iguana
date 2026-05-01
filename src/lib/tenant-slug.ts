/**
 * Tenant slug validation — pure function, no DB.
 *
 * Pure-function side ensures format + reserved-word safety. DB uniqueness is
 * checked separately by callers (the create-tenant route runs validateSlug,
 * then attempts an insert and treats UNIQUE-violation as 409).
 *
 * Reserved words exist because /[slug] sits beside /admin, /api, /sign-in
 * etc. — letting a tenant create slug=admin would shadow the admin tree.
 */
export const RESERVED_SLUGS = [
  // Top-level Next routes used by this app
  "admin",
  "api",
  "sign-in",
  "sign-up",
  "forbidden",
  "super",
  // Asset / framework conventions
  "_next",
  "_vercel",
  "favicon",
  "favicon.ico",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  // Operational reservations for future use
  "settings",
  "new",
  "new-reunion",
  "create",
  "tenants",
  "reunions",
  "billing",
  "support",
  "docs",
  "help",
  "status",
  "about",
  "pricing",
  "login",
  "logout",
  "auth",
  "callback",
  "webhooks",
  "health",
] as const;

const RESERVED_SET = new Set<string>(RESERVED_SLUGS);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export type SlugValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateSlug(input: string): SlugValidationResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "Slug must be a string." };
  }
  const slug = input.trim();
  if (slug.length === 0) {
    return { ok: false, reason: "Slug is required." };
  }
  if (slug.length < 3) {
    return { ok: false, reason: "Slug must be at least 3 characters." };
  }
  if (slug.length > 40) {
    return { ok: false, reason: "Slug must be 40 characters or fewer." };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      reason:
        "Slug must use lowercase letters, digits, and hyphens; no leading or trailing hyphen.",
    };
  }
  if (RESERVED_SET.has(slug)) {
    return { ok: false, reason: `"${slug}" is reserved — pick another slug.` };
  }
  return { ok: true };
}
