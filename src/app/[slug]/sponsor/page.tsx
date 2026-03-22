import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SponsorForm } from "@/components/sponsor-form";
import { formatCents } from "@/lib/utils";
import { SPONSOR_TIER_THRESHOLD_CENTS } from "@/lib/constants";

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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Sponsor the Reunion
          </h1>
          <p className="text-gray-600">
            Help make our 30-year reunion unforgettable. Your sponsorship
            directly supports the event and our classmates.
          </p>
        </div>

        {/* Tier explanation */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
            <h3 className="mb-1 text-lg font-bold text-red-900">
              Top Sponsor
            </h3>
            <p className="mb-2 text-sm font-medium text-red-700">
              {formatCents(SPONSOR_TIER_THRESHOLD_CENTS)} and above
            </p>
            <p className="text-sm text-red-800">
              Your contribution offsets event costs — helping keep ticket prices
              low for everyone. Featured prominently on our sponsors page.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="mb-1 text-lg font-bold text-gray-900">
              Community Service Sponsor
            </h3>
            <p className="mb-2 text-sm font-medium text-gray-500">
              Under {formatCents(SPONSOR_TIER_THRESHOLD_CENTS)}
            </p>
            <p className="text-sm text-gray-600">
              Your contribution funds our community service efforts — giving
              back to the Park Hill community that shaped us.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Note:</strong> This is not a tax-deductible donation. Sponsor
          contributions are processed through a personal business entity and
          relayed to the reunion organizers. You will receive a receipt from
          Stripe for your records.
        </div>

        <SponsorForm reunionId={reunion.id} slug={slug} />
      </div>
    </div>
  );
}
