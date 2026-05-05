import { db } from "@/lib/db";
import { reunions, events } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { HelpSection } from "@/components/help-section";
import { TeaseLanding } from "@/components/tease-landing";
import { getAdminPreviewState } from "@/lib/site-mode";

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

  const previewState = await getAdminPreviewState(reunion);
  const effectiveMode = previewState.effectiveMode;

  // Tease mode — show the teaser landing
  if (effectiveMode === "tease") {
    const reunionEvents = await db
      .select()
      .from(events)
      .where(eq(events.reunionId, reunion.id))
      .orderBy(asc(events.sortOrder));

    // Show the AdminMenu inside TeaseLanding only when no banner is also
    // showing (i.e., previewing the same mode as actual, or no preview).
    // If the admin is previewing tease while actual is something else,
    // the AdminPreviewBanner above will own the menu.
    const showAdminMenu =
      previewState.isAdmin &&
      (previewState.previewMode === null ||
        previewState.previewMode === previewState.actualMode);

    return (
      <TeaseLanding
        reunion={{
          id: reunion.id,
          slug: reunion.slug,
          name: reunion.name,
          description: reunion.description,
          eventDate: reunion.eventDate,
        }}
        events={reunionEvents}
        isAdmin={previewState.isAdmin}
        showAdminMenu={showAdminMenu}
        previewMode={previewState.previewMode}
        actualMode={previewState.actualMode}
        customDomain={reunion.customDomain}
      />
    );
  }

  // pre_register or open mode — show the full landing page
  const isOpen = effectiveMode === "open";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-tenant-primary to-tenant-darkest text-white">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-tenant-on-dark">
            You&apos;re Invited
          </p>
          <h1 className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
            {reunion.name}
          </h1>
          <p className="mb-6 text-2xl font-semibold text-tenant-on-dark">
            30 Year Reunion
          </p>
          <p className="mx-auto mb-10 max-w-xl text-lg text-tenant-on-dark">
            {reunion.description}
          </p>
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-white px-8 py-3 text-lg font-semibold text-tenant-primary shadow-lg transition hover:bg-tenant-tint hover:shadow-xl"
          >
            {isOpen ? "Register Now" : "Pre-Register"}
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
            <p className="text-lg font-medium">
              {formatCents(reunion.registrationFeeCents)} per person
            </p>
            <p className="mt-1 text-gray-600">
              {isOpen ? "Banquet & festivities" : "Pre-register now, pay later"}
            </p>
          </div>
        </div>

        {/* Help / Contact section */}
        <HelpSection reunionId={reunion.id} />

        {/* Community Service Project */}
        <div className="mt-12 rounded-2xl border-2 border-tenant-border-soft bg-gradient-to-br from-tenant-tint to-white p-8 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-tenant-primary">
            Community Service Project
          </p>
          <h3 className="mb-2 text-2xl font-bold text-gray-900">
            96 Backpacks
          </h3>
          <p className="mb-4 text-gray-700">
            Saturday morning, we&apos;re assembling 96 backpacks of school
            supplies for Park Hill students — partnering with Replenish KC.
          </p>
          <Link
            href={`/${slug}/community-service`}
            className="inline-block text-sm font-semibold text-tenant-primary hover:text-tenant-primary-deep"
          >
            Learn about 96 Backpacks &rarr;
          </Link>
        </div>

        <div className="mt-12 text-center">
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-tenant-primary px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep"
          >
            {isOpen
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
