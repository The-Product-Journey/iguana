"use client";

import { useEffect, useState } from "react";

/**
 * Compute the URL for the "Admin Mode" link on a public reunion page.
 *
 * The link points at `/admin-mode?return=<canonical-path>`. The proxy's
 * admin gate forces a sign-in if the visitor isn't already authenticated
 * AND bounces vanity-domain requests to the canonical Clerk-bound host
 * (where admin UI works). After auth, the /admin-mode handler redirects
 * to the return path.
 *
 * `return` must be the canonical (slug-prefixed) path, NOT the visible
 * URL. On a vanity domain the user sees `/yearbook` while the route is
 * really `/[slug]/yearbook` — we prepend the slug so the admin lands on
 * the same content on the canonical host.
 *
 * Computed in useEffect to avoid SSR/CSR mismatch (the path depends on
 * window.location, which doesn't exist server-side). Initial render
 * ships with a sensible default of `/<slug>` so the link is functional
 * even before hydration.
 */
export function useAdminModeHref(slug: string): string {
  const [href, setHref] = useState(
    `/admin-mode?return=${encodeURIComponent(`/${slug}`)}`
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname + window.location.search;
    const slugPrefix = `/${slug}`;
    // If the visible path already starts with /<slug>, we're on the
    // canonical host — use the path as-is. Otherwise (vanity domain) the
    // slug is hidden via middleware rewrite, so we prepend it.
    const canonical =
      path === slugPrefix || path.startsWith(`${slugPrefix}/`)
        ? path
        : `${slugPrefix}${path === "/" ? "" : path}`;
    setHref(`/admin-mode?return=${encodeURIComponent(canonical)}`);
  }, [slug]);

  return href;
}
