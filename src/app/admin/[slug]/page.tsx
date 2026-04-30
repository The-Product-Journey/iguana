import { db } from "@/lib/db";
import {
  reunions,
  rsvps,
  contactMessages,
  interestSignups,
  eventInterests,
  sponsors,
  memorials,
  profiles,
  events,
  registrationEvents,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { SiteModeToggle } from "@/components/site-mode-toggle";
import { AdminTabs } from "./admin-tabs";
import { ConnectStatus } from "@/components/connect-status";

export const dynamic = "force-dynamic";

export default async function AdminReunionPage({
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

  // Fetch all data in parallel
  const [
    allRsvps,
    messages,
    allInterests,
    allSponsors,
    allMemorials,
    allProfiles,
    allEvents,
  ] = await Promise.all([
    db
      .select()
      .from(rsvps)
      .where(eq(rsvps.reunionId, reunion.id))
      .orderBy(desc(rsvps.createdAt)),
    db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.reunionId, reunion.id))
      .orderBy(desc(contactMessages.createdAt)),
    db
      .select()
      .from(interestSignups)
      .where(eq(interestSignups.reunionId, reunion.id))
      .orderBy(desc(interestSignups.createdAt)),
    db
      .select()
      .from(sponsors)
      .where(eq(sponsors.reunionId, reunion.id))
      .orderBy(desc(sponsors.createdAt)),
    db
      .select()
      .from(memorials)
      .where(eq(memorials.reunionId, reunion.id))
      .orderBy(desc(memorials.createdAt)),
    db
      .select({
        profile: profiles,
        firstName: rsvps.firstName,
        lastName: rsvps.lastName,
        email: rsvps.email,
        editToken: rsvps.editToken,
      })
      .from(profiles)
      .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id)),
    db
      .select()
      .from(events)
      .where(eq(events.reunionId, reunion.id))
      .orderBy(events.sortOrder),
  ]);

  // Get event interest counts
  const interestEventCounts: Record<string, number> = {};
  for (const interest of allInterests) {
    const ei = await db
      .select()
      .from(eventInterests)
      .where(eq(eventInterests.interestSignupId, interest.id));
    for (const e of ei) {
      interestEventCounts[e.eventId] = (interestEventCounts[e.eventId] || 0) + 1;
    }
  }

  // Get registration event counts
  const regEventCounts: Record<string, { confirmed: number; pending: number }> = {};
  for (const event of allEvents) {
    const regs = await db
      .select({ rsvpId: registrationEvents.rsvpId })
      .from(registrationEvents)
      .where(eq(registrationEvents.eventId, event.id));

    let confirmed = 0;
    let pending = 0;
    for (const reg of regs) {
      const rsvp = allRsvps.find((r) => r.id === reg.rsvpId);
      if (!rsvp) continue;
      if (rsvp.paymentStatus === "paid" || rsvp.paymentMethod === "door") {
        confirmed++;
      } else {
        pending++;
      }
    }
    regEventCounts[event.id] = { confirmed, pending };
  }

  const paidRsvps = allRsvps.filter((r) => r.paymentStatus === "paid");
  const totalRevenue = paidRsvps.reduce(
    (sum, r) => sum + (r.amountPaidCents || 0),
    0
  );
  const totalFeesCovered = paidRsvps.reduce(
    (sum, r) => sum + (r.donationCents || 0),
    0
  );
  const totalGuests = paidRsvps.reduce((sum, r) => sum + r.guestCount, 0);
  const totalSponsorRevenue = allSponsors
    .filter((s) => s.paymentStatus === "paid")
    .reduce((sum, s) => sum + s.amountCents, 0);

  const CATEGORY_LABELS: Record<string, string> = {
    volunteer: "Volunteer",
    photos: "Photos",
    entertainment: "Entertainment",
    classmate_passed: "Classmate Passed",
    other: "Other",
  };

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-red-700 hover:text-red-800"
      >
        &larr; Back to dashboard
      </Link>

      <h2 className="mb-4 text-2xl font-bold">{reunion.name}</h2>

      <SiteModeToggle
        reunionId={reunion.id}
        initialMode={reunion.siteMode}
      />

      <ConnectStatus
        reunionId={reunion.id}
        slug={slug}
        connectedAccountId={reunion.stripeConnectedAccountId}
        initialHasAccount={!!reunion.stripeConnectedAccountId}
        initialOnboardingComplete={!!reunion.stripeConnectOnboardingComplete}
        initialChargesEnabled={!!reunion.stripeConnectChargesEnabled}
        initialPayoutsEnabled={!!reunion.stripeConnectPayoutsEnabled}
      />

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Confirmed</p>
          <p className="text-2xl font-bold">{paidRsvps.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Guests</p>
          <p className="text-2xl font-bold">{totalGuests}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="text-2xl font-bold">{formatCents(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Fees Covered</p>
          <p className="text-2xl font-bold">{formatCents(totalFeesCovered)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sponsorships</p>
          <p className="text-2xl font-bold">
            {formatCents(totalSponsorRevenue)}
          </p>
        </div>
      </div>

      <AdminTabs
        slug={slug}
        rsvps={allRsvps}
        interests={allInterests}
        sponsors={allSponsors}
        memorials={allMemorials}
        profiles={allProfiles}
        events={allEvents}
        messages={messages}
        interestEventCounts={interestEventCounts}
        regEventCounts={regEventCounts}
        categoryLabels={CATEGORY_LABELS}
      />
    </div>
  );
}
