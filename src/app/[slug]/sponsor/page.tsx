import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SponsorForm } from "@/components/sponsor-form";
import { formatCents } from "@/lib/utils";
import { SPONSOR_TIER_THRESHOLD_CENTS } from "@/lib/constants";
import { loadConnectAccount } from "@/lib/stripe";

export default async function SponsorPage({
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

  const connect = await loadConnectAccount(reunion.id);
  const canTakePayments = !!connect?.chargesEnabled;

  return (
    <div className="min-h-screen bg-tenant-tint py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-ink">
            Sponsor the Reunion
          </h1>
          <p className="text-ink-muted">
            Help make our 30-year reunion unforgettable. Your sponsorship
            directly supports the event and our classmates.
          </p>
        </div>

        {/* Tier explanation */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="relative rounded-xl border border-tenant-primary bg-white p-6">
            <span className="absolute right-3 top-3 rounded-md bg-tenant-primary px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              Marquee
            </span>
            <h3 className="mb-1 pr-20 text-lg font-bold text-ink">
              Trojan Sponsor
            </h3>
            <p className="mb-2 text-sm font-medium text-ink-subtle">
              {formatCents(SPONSOR_TIER_THRESHOLD_CENTS)} and above
            </p>
            <p className="text-sm text-ink-muted">
              Recognized online and on signage at select reunion events. Helps
              offset event costs to keep ticket prices low for everyone.
            </p>
          </div>
          <div className="rounded-xl border border-tenant-primary bg-white p-6">
            <h3 className="mb-1 text-lg font-bold text-ink">
              Community Service Project Sponsor
            </h3>
            <p className="mb-2 text-sm font-medium text-ink-subtle">
              Under {formatCents(SPONSOR_TIER_THRESHOLD_CENTS)}
            </p>
            <p className="text-sm text-ink-muted">
              Recognized online. Funds the 96 Backpacks community service
              project — giving back to Park Hill schools.{" "}
              <Link
                href={`/${slug}/community-service`}
                className="font-medium text-tenant-primary hover:text-tenant-primary-deep"
              >
                Learn more &rarr;
              </Link>
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-site-warning/30 bg-site-warning-tint p-4 text-sm text-site-warning">
          <strong>Note:</strong> This is not a tax-deductible donation. Sponsor
          contributions are sent directly to the reunion organizers via
          Stripe. You will receive a receipt from Stripe for your records.
        </div>

        {canTakePayments ? (
          <SponsorForm reunionId={reunion.id} slug={slug} />
        ) : (
          <div className="rounded-xl border border-site-warning/30 bg-site-warning-tint p-8 text-center">
            <p className="text-lg font-semibold text-site-warning">
              Sponsorships coming soon
            </p>
            <p className="mt-2 text-sm text-site-warning">
              Online payments are being set up. Check back shortly to submit your sponsorship.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
