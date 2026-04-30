import { db } from "@/lib/db";
import { reunions, events } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { RegistrationForm } from "@/components/registration-form";
import { InlineInterestForm } from "@/components/inline-interest-form";
import { getEffectiveSiteMode } from "@/lib/site-mode";

export default async function RsvpPage({
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

  const effectiveMode = await getEffectiveSiteMode(reunion);

  // Tease mode — redirect to landing
  if (effectiveMode === "tease") {
    redirect(`/${slug}`);
  }

  const reunionEvents = await db
    .select()
    .from(events)
    .where(eq(events.reunionId, reunion.id))
    .orderBy(asc(events.sortOrder));

  // Pre-register mode — show interest form inline
  if (effectiveMode === "pre_register") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-xl px-6">
          <Link
            href={`/${slug}`}
            className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
          >
            &larr; Back to event
          </Link>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">{reunion.name}</h1>
            <p className="mt-2 text-gray-600">
              Registration isn&apos;t open yet, but you can sign up to be
              notified when it is.
            </p>
          </div>
          <InlineInterestForm
            reunionId={reunion.id}
            slug={slug}
            events={reunionEvents}
          />
        </div>
      </div>
    );
  }

  // Open mode — full registration
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{reunion.name}</h1>
          <p className="mt-2 text-gray-600">
            Register for the reunion events below.
          </p>
        </div>
        <RegistrationForm
          reunionId={reunion.id}
          slug={slug}
          events={reunionEvents}
          chargesEnabled={!!reunion.stripeConnectChargesEnabled && !!reunion.stripeConnectedAccountId}
        />
      </div>
    </div>
  );
}
