import Link from "next/link";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { REFUND_POLICY_TEXT } from "@/lib/constants";
import { SponsorRecognitionForm } from "@/components/sponsor-recognition-form";

export default async function SponsorConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  // Look up the sponsor for this checkout session so we can show the
  // recognition form pre-filled. If the session_id isn't on the URL or
  // the sponsor row hasn't landed yet (webhook delay), we fall back to
  // the simple thank-you message without the customization form.
  let sponsor = null;
  if (session_id) {
    sponsor =
      (await db
        .select()
        .from(sponsors)
        .where(eq(sponsors.stripeCheckoutSessionId, session_id))
        .get()) ?? null;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">🙏</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Thank You for Your Sponsorship!
          </h1>
          <p className="mb-6 text-gray-600">
            Your generous contribution helps make our 30-year reunion possible.
            Your sponsorship will be featured on our sponsors page once
            reviewed by the reunion committee.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/${slug}/sponsors`}
              className="inline-block rounded-full bg-tenant-primary px-6 py-2 font-semibold text-white transition hover:bg-tenant-primary-deep"
            >
              View Sponsors
            </Link>
            <Link
              href={`/${slug}`}
              className="text-sm text-tenant-primary hover:text-tenant-primary-deep"
            >
              &larr; Back to event page
            </Link>
          </div>
          <p className="mt-6 text-xs text-gray-400">{REFUND_POLICY_TEXT}</p>
        </div>

        {sponsor && session_id && (
          <SponsorRecognitionForm
            sessionId={session_id}
            initial={{
              contactName: sponsor.contactName,
              companyName: sponsor.companyName,
              displayName: sponsor.displayName,
              isAnonymous: sponsor.isAnonymous,
              message: sponsor.message,
              websiteUrl: sponsor.websiteUrl,
              logoUrl: sponsor.logoUrl,
            }}
          />
        )}
      </div>
    </div>
  );
}
