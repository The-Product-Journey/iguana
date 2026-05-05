import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { SiteCard } from "@/components/site-card";
import { CreateSiteCard } from "@/components/create-site-card";
import { Wordmark } from "@/components/wordmark";

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
  const sites = await db
    .select()
    .from(reunions)
    .where(eq(reunions.isActive, true))
    .orderBy(asc(reunions.name))
    .all();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border-warm bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4 sm:px-12">
          <Wordmark className="h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:px-12">
        <h1 className="mb-10 font-serif text-4xl font-light italic text-ink">
          Sites
        </h1>

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
