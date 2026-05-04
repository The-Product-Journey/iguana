/**
 * Per-reunion vanity domains, sourced from the `reunions.custom_domain`
 * column.
 *
 * The proxy middleware calls these helpers on every request to map an
 * inbound host to a reunion slug (so requests to a vanity domain rewrite
 * to /[slug]/...). To avoid hammering the DB, we cache the full
 * { customDomain → slug } and { slug → customDomain } maps in module
 * memory with a short TTL. Cache misses populate from one query that
 * pulls every reunion with a non-null custom_domain — fine at the scale
 * of one reunion app; grows linearly with tenant count.
 *
 * Admin saves to /api/admin/reunion-customization don't actively bust
 * this cache — the TTL is short enough (60s) that a save propagates on
 * its own. If we ever need instant propagation, expose a bust() helper
 * that the API route calls after a successful update.
 */
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

const CACHE_TTL_MS = 60_000;

type DomainMap = {
  hostToSlug: Map<string, string>;
  slugToHost: Map<string, string>;
};

let cache: { data: DomainMap; expiresAt: number } | null = null;

async function load(): Promise<DomainMap> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const rows = await db
    .select({ slug: reunions.slug, customDomain: reunions.customDomain })
    .from(reunions)
    .where(isNotNull(reunions.customDomain))
    .all();

  const hostToSlug = new Map<string, string>();
  const slugToHost = new Map<string, string>();
  for (const r of rows) {
    if (!r.customDomain) continue;
    const host = r.customDomain.toLowerCase();
    hostToSlug.set(host, r.slug);
    slugToHost.set(r.slug, host);
  }

  cache = { data: { hostToSlug, slugToHost }, expiresAt: Date.now() + CACHE_TTL_MS };
  return cache.data;
}

/** Manually invalidate the cache after a save. Optional — natural TTL also works. */
export function invalidateTenantDomainsCache(): void {
  cache = null;
}

/** Map an inbound host to the reunion slug it should serve, if any. */
export async function slugForHost(
  host: string | null | undefined
): Promise<string | null> {
  if (!host) return null;
  const { hostToSlug } = await load();
  return hostToSlug.get(host.toLowerCase()) ?? null;
}

/**
 * Construct the public URL for a reunion (used by admin "Open public site"
 * links). Returns null when the reunion has no vanity domain configured —
 * caller should fall back to the canonical /[slug] path.
 */
export async function vanityHomeForSlug(slug: string): Promise<string | null> {
  const { slugToHost } = await load();
  const host = slugToHost.get(slug);
  return host ? `https://${host}` : null;
}
