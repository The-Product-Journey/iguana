import type { Reunion } from "@/lib/db/schema";

/**
 * Site card on the platform homepage. Renders one reunion's at-a-glance
 * summary (favicon, domain, name, status) with a hover affordance that
 * reveals "Go to site →" — modeled after the Clerk dashboard's apps grid.
 *
 * The whole card is a link to the reunion's public URL: vanity domain when
 * configured, otherwise the canonical /[slug] path.
 */
export function SiteCard({ site }: { site: Reunion }) {
  // Always link to the platform path (relative). Using the configured
  // custom domain here would force admins testing locally / on staging
  // to bounce to the production vanity URL — confusing and breaks the
  // "see the site as it lives in this environment" expectation.
  const href = `/${site.slug}`;
  const displayDomain = site.customDomain ?? `/${site.slug}`;
  const faviconUrl = site.faviconUrl ?? "/favicon.svg";

  return (
    <a
      href={href}
      className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-border-warm bg-white transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
      aria-label={`Open ${site.name}`}
    >
      <div className="h-1.5 bg-gradient-to-r from-red-600 to-red-900" />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-10 flex items-start justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- vercel blob URLs vary; <Image> would need explicit whitelist */}
          <img
            src={faviconUrl}
            alt=""
            className="h-10 w-10 rounded-md object-contain"
          />
          <span className="truncate font-mono text-xs text-ink-muted">
            {displayDomain}
          </span>
        </div>
        <div className="mt-auto">
          <h3 className="mb-2 text-lg font-semibold text-ink">{site.name}</h3>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Production
          </span>
        </div>
      </div>
      <div className="border-t border-border-warm bg-bg-subtle px-6 py-3">
        <span className="text-sm font-medium text-ink-subtle transition-colors group-hover:text-forest">
          Go to site →
        </span>
      </div>
    </a>
  );
}
