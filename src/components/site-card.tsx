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
  const href = site.customDomain
    ? `https://${site.customDomain}`
    : `/${site.slug}`;
  const displayDomain = site.customDomain ?? `/${site.slug}`;
  const faviconUrl = site.faviconUrl ?? "/favicon.svg";
  const isExternal = !!site.customDomain;

  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
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
          <span className="truncate font-mono text-xs text-gray-600">
            {displayDomain}
          </span>
        </div>
        <div className="mt-auto">
          <h3 className="mb-2 text-lg font-bold text-gray-900">{site.name}</h3>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Production
          </span>
        </div>
      </div>
      <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3">
        <span className="text-sm font-medium text-gray-400 transition-colors group-hover:text-gray-900">
          Go to site →
        </span>
      </div>
    </a>
  );
}
