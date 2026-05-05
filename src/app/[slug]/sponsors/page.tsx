import { db } from "@/lib/db";
import { reunions, sponsors } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { resolveSponsorDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (!reunion) notFound();

  const allSponsors = await db
    .select()
    .from(sponsors)
    .where(
      and(
        eq(sponsors.reunionId, reunion.id),
        eq(sponsors.isDisplayed, true),
        eq(sponsors.paymentStatus, "paid")
      )
    )
    .orderBy(desc(sponsors.amountCents));

  const topSponsors = allSponsors.filter((s) => s.tier === "top");
  const communitySponsors = allSponsors.filter((s) => s.tier === "community");

  return (
    <div className="min-h-screen bg-bg-subtle py-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-bold text-ink">
            Our Sponsors
          </h1>
          <p className="text-ink-muted">
            Thank you to these generous sponsors who make our reunion possible.
          </p>
        </div>

        {allSponsors.length === 0 ? (
          <div className="rounded-xl border border-border-warm bg-white p-12 text-center shadow-sm">
            <p className="text-ink-subtle">No sponsors yet — be the first!</p>
            <Link
              href={`/${slug}/sponsor`}
              className="mt-4 inline-block rounded-full bg-tenant-primary px-6 py-2 font-semibold text-white transition hover:bg-tenant-primary-deep"
            >
              Become a Sponsor
            </Link>
          </div>
        ) : (
          <>
            {/* Trojan Sponsors */}
            {topSponsors.length > 0 && (
              <div className="mb-10">
                <h2 className="mb-4 text-lg font-semibold text-tenant-primary-deep uppercase tracking-wide">
                  Trojan Sponsors
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {topSponsors.map((sponsor) => {
                    const displayName = resolveSponsorDisplayName(sponsor);
                    const showLogo = !sponsor.isAnonymous && sponsor.logoUrl;
                    const showLink =
                      !sponsor.isAnonymous && sponsor.websiteUrl;
                    return (
                      <div
                        key={sponsor.id}
                        className="rounded-xl border-2 border-tenant-border-soft bg-tenant-tint p-6 shadow-sm"
                      >
                        {showLogo && (
                          <div className="mb-4 flex h-24 items-center justify-center">
                            <Image
                              src={sponsor.logoUrl!}
                              alt={displayName}
                              width={200}
                              height={96}
                              className="max-h-24 w-auto object-contain"
                            />
                          </div>
                        )}
                        <h3 className="text-lg font-bold text-ink">
                          {showLink ? (
                            <a
                              href={sponsor.websiteUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-tenant-primary"
                            >
                              {displayName}
                            </a>
                          ) : (
                            displayName
                          )}
                        </h3>
                        {!sponsor.isAnonymous && sponsor.message && (
                          <p className="mt-2 text-sm text-ink-muted">
                            {sponsor.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Community Service Project Sponsors */}
            {communitySponsors.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-ink-muted uppercase tracking-wide">
                  Community Service Project Sponsors
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {communitySponsors.map((sponsor) => {
                    const displayName = resolveSponsorDisplayName(sponsor);
                    const showLogo = !sponsor.isAnonymous && sponsor.logoUrl;
                    const showLink =
                      !sponsor.isAnonymous && sponsor.websiteUrl;
                    return (
                      <div
                        key={sponsor.id}
                        className="rounded-lg border border-border-warm bg-white p-4 shadow-sm"
                      >
                        {showLogo && (
                          <div className="mb-3 flex h-16 items-center justify-center">
                            <Image
                              src={sponsor.logoUrl!}
                              alt={displayName}
                              width={120}
                              height={64}
                              className="max-h-16 w-auto object-contain"
                            />
                          </div>
                        )}
                        <h3 className="text-sm font-semibold text-ink">
                          {showLink ? (
                            <a
                              href={sponsor.websiteUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-tenant-primary"
                            >
                              {displayName}
                            </a>
                          ) : (
                            displayName
                          )}
                        </h3>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Bottom CTA — hidden when the empty state already provides one */}
        {allSponsors.length > 0 && (
          <div className="mt-12 text-center">
            <Link
              href={`/${slug}/sponsor`}
              className="inline-block rounded-full bg-tenant-primary px-6 py-2 font-semibold text-white transition hover:bg-tenant-primary-deep"
            >
              Become a Sponsor
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
