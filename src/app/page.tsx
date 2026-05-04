import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { SiteCard } from "@/components/site-card";
import { CreateSiteCard } from "@/components/create-site-card";

export const dynamic = "force-dynamic";

/**
 * Platform homepage. Shows all production-grade reunions as cards
 * (Clerk-style apps grid). Test tenants (slug ending `-test`) and
 * inactive reunions are hidden — this surface is meant for production
 * sites only.
 *
 * Note: this page only renders on the canonical platform domain. Tenant
 * vanity domains (e.g. www.parkhill1996reunion.com) have their `/`
 * rewritten to `/[slug]/` by the proxy middleware before reaching this
 * route, so visitors to a vanity URL never see this grid — they go
 * straight to the reunion site.
 */
export default async function Home() {
  const all = await db
    .select()
    .from(reunions)
    .where(eq(reunions.isActive, true))
    .orderBy(asc(reunions.name))
    .all();

  const sites = all.filter((r) => !r.slug.endsWith("-test"));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- public asset, no perf concern */}
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-base font-semibold text-gray-900">
              Glad You Made It
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Sites</h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <CreateSiteCard />
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      </main>
    </div>
  );
}
