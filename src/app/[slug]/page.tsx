import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { HelpSection } from "@/components/help-section";

export default async function ReunionPage({
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
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-red-700 to-red-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-200">
            You&apos;re Invited
          </p>
          <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {reunion.name}
          </h1>
          <p className="mb-6 text-2xl font-semibold text-red-100">
            30 Year Reunion
          </p>
          <p className="mx-auto mb-10 max-w-xl text-lg text-red-100">
            {reunion.description}
          </p>
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-white px-8 py-3 text-lg font-semibold text-red-700 shadow-lg transition hover:bg-red-50 hover:shadow-xl"
          >
            {reunion.registrationOpen ? "Register Now" : "Pre-Register"}
          </Link>
        </div>
      </div>

      {/* Details */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              When
            </h3>
            <p className="text-lg font-medium">August 28–29, 2026</p>
            <p className="mt-1 text-gray-600">Friday &amp; Saturday</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Saturday Banquet
            </h3>
            <p className="text-lg font-medium">{reunion.eventLocation}</p>
            {reunion.eventAddress && (
              <p className="mt-1 text-gray-600">{reunion.eventAddress}</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Registration
            </h3>
            {reunion.registrationOpen ? (
              <>
                <p className="text-lg font-medium">
                  {formatCents(reunion.registrationFeeCents)} per person
                </p>
                <p className="mt-1 text-gray-600">Banquet &amp; festivities</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">
                  {formatCents(reunion.registrationFeeCents)} per person
                </p>
                <p className="mt-1 text-gray-600">
                  Pre-register now, pay later
                </p>
              </>
            )}
          </div>
        </div>

        {/* Help / Contact section */}
        <HelpSection reunionId={reunion.id} />

        <div className="mt-12 text-center">
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-red-700 px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800"
          >
            {reunion.registrationOpen
              ? "Register & Pay"
              : "Pre-Register — Save Your Spot"}
          </Link>
          <p className="mt-4 text-gray-500">
            Start making your arrangements and travel plans now!
          </p>
        </div>
      </div>
    </div>
  );
}
