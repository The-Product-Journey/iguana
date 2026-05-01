import { db } from "@/lib/db";
import { reunions, events } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { HelpSection } from "@/components/help-section";
import { TeaseLanding } from "@/components/tease-landing";
import { getAdminPreviewState } from "@/lib/site-mode";
import { getTenantConfig } from "@/lib/tenant-config";

// Format an ISO date (YYYY-MM-DD) into a human-friendly "When" card line
// without dragging in a date library. SSR-only — no locale negotiation.
function formatReunionDate(eventDate: string): { when: string; days: string } {
  // The schema stores eventDate as a YYYY-MM-DD string. We treat it as the
  // first day of a one- or two-day reunion and format both parts.
  const start = new Date(`${eventDate}T00:00:00Z`);
  if (isNaN(start.getTime())) {
    return { when: eventDate, days: "" };
  }
  const monthFmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const dayNumFmt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "UTC",
  });
  const yearFmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "UTC",
  });
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    when: `${monthFmt.format(start)} ${dayNumFmt.format(start)}–${dayNumFmt.format(next)}, ${yearFmt.format(start)}`,
    days: `${dayFmt.format(start)} & ${dayFmt.format(next)}`,
  };
}

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
      />
    );
  }

  // pre_register or open mode — show the full landing page
  const isOpen = effectiveMode === "open";
  const tenantConfig = getTenantConfig(reunion);
  const { when, days } = formatReunionDate(reunion.eventDate);

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
          {tenantConfig.reunionMilestoneLabel && (
            <p className="mb-6 text-2xl font-semibold text-red-100">
              {tenantConfig.reunionMilestoneLabel}
            </p>
          )}
          <p className="mx-auto mb-10 max-w-xl text-lg text-red-100">
            {reunion.description}
          </p>
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-white px-8 py-3 text-lg font-semibold text-red-700 shadow-lg transition hover:bg-red-50 hover:shadow-xl"
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
            <p className="text-lg font-medium">{when}</p>
            {days && <p className="mt-1 text-gray-600">{days}</p>}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {tenantConfig.banquetLabel}
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

        {/* Community Service Project — only when configured */}
        {tenantConfig.hasCommunityServiceProject && (
          <div className="mt-12 rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-8 shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-700">
              Community Service Project
            </p>
            <h3 className="mb-2 text-2xl font-bold text-gray-900">
              {tenantConfig.communityServiceProjectName}
            </h3>
            {tenantConfig.communityServiceTeaserCopy && (
              <p className="mb-4 text-gray-700 whitespace-pre-line">
                {tenantConfig.communityServiceTeaserCopy}
              </p>
            )}
            <Link
              href={`/${slug}/community-service`}
              className="inline-block text-sm font-semibold text-red-700 hover:text-red-800"
            >
              Learn about {tenantConfig.communityServiceProjectName} &rarr;
            </Link>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-red-700 px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800"
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
