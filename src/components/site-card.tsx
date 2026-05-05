import Link from "next/link";
import type { Reunion } from "@/lib/db/schema";

/**
 * Site card on the platform homepage. Shows a reunion's identity at a
 * glance — favicon, name, status, configured URLs — and routes the
 * primary CTA to that site's admin settings (deep link to /admin/<slug>).
 *
 * The top color stripe uses the reunion's configured brand color so each
 * card carries a small visual cue of the tenant's identity. Without a
 * brand color set, falls back to brand cream — making the act of picking
 * a brand color feel like a deliberate, visible product choice rather
 * than just swapping one default for another.
 *
 * Multiple clickable areas:
 * - The displayed URLs (custom domain when set, plus the platform path)
 *   are individual links that open the public site in a new tab.
 * - The "Site settings →" footer is the primary action: deep-link to the
 *   per-reunion admin page.
 *
 * The card itself is NOT a link wrapper — Site Cards have multiple
 * distinct interactive children, so wrapping them in a single anchor
 * would either swallow inner clicks or violate "no anchor inside anchor."
 */
export function SiteCard({ site }: { site: Reunion }) {
  const platformPath = `/${site.slug}`;
  const faviconUrl = site.faviconUrl ?? "/favicon.svg";
  const isTest = site.slug.endsWith("-test");

  // The brand color stripe at the top. Inline style so each card uses
  // its own reunion's brand color. Cream when the admin hasn't picked a
  // brand color yet — the stripe lights up the moment they configure one.
  const stripeColor = site.brandColor ?? "var(--color-cream)";

  return (
    <div className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-border-warm bg-white transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <div
        className="h-1.5"
        style={{ backgroundColor: stripeColor }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- vercel blob URLs vary; <Image> would need explicit whitelist */}
          <img
            src={faviconUrl}
            alt=""
            className="h-10 w-10 rounded-md object-contain"
          />
          <div className="flex flex-col items-end gap-0.5 truncate text-xs">
            {site.customDomain && (
              <a
                href={`https://${site.customDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-ink hover:text-forest hover:underline"
              >
                {site.customDomain}
              </a>
            )}
            <a
              href={platformPath}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-mono text-ink-subtle hover:text-forest hover:underline"
            >
              {site.slug}
            </a>
          </div>
        </div>
        <div className="mt-auto">
          <h3 className="mb-2 text-lg font-semibold text-ink">{site.name}</h3>
          {isTest ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Test
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Production
            </span>
          )}
        </div>
      </div>
      <Link
        href={`/admin/${site.slug}`}
        className="block border-t border-border-warm bg-bg-subtle px-6 py-3 text-sm font-medium text-ink-subtle transition-colors hover:bg-cream hover:text-forest"
        aria-label={`Settings for ${site.name}`}
      >
        Site settings →
      </Link>
    </div>
  );
}
