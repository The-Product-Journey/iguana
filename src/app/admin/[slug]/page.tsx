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
import { InfoTooltip } from "@/components/info-tooltip";
import { LaunchSiteMenu } from "@/components/launch-site-menu";
import { SiteCustomization } from "@/components/site-customization";
import { CollapsibleCard } from "@/components/collapsible-card";
import { BackLink } from "@/components/back-link";
import { TestTag } from "@/components/test-tag";
import { EditableSiteName } from "@/components/editable-site-name";
import { requireReunionAdminPage } from "@/lib/admin-auth";
import { loadConnectAccount, getConnectAccountName } from "@/lib/stripe";

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

  // Per-reunion scope guard. The proxy only enforces "is any admin"; here
  // we ensure a reunion-A admin can't load reunion-B's dashboard by URL.
  // Super admins always pass. Capture the context so we can pass
  // role-aware bits down (e.g. super-admin-only Stripe correlation links).
  const ctx = await requireReunionAdminPage(reunion.id);

  // Fetch all data in parallel
  const [
    allRsvps,
    messages,
    allInterests,
    allSponsors,
    allMemorials,
    allProfiles,
    allEvents,
    connect,
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
      .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
      // Reunion-scope filter — without this, the join returns profiles for
      // every reunion. Dormant today (single reunion) but exploitable the
      // moment per-tenant admins exist.
      .where(eq(rsvps.reunionId, reunion.id)),
    db
      .select()
      .from(events)
      .where(eq(events.reunionId, reunion.id))
      .orderBy(events.sortOrder),
    loadConnectAccount(reunion.id),
  ]);

  // Live-resolve the connected account's display name from Stripe so
  // admins can read it instead of correlating account IDs by hand.
  // Best-effort: a failure here just renders "name unavailable" in
  // the info tooltip and doesn't break the page.
  const connectAccountName = connect?.accountId
    ? await getConnectAccountName(connect.accountId)
    : null;

  // Build cross-indexed interest data so both tabs can drill in:
  //   - Interests tab: click an interest signup's count → list of events
  //     they marked
  //   - Events tab: click an event's interest count → list of signups
  //     interested in that event
  const eventNameById = new Map(allEvents.map((e) => [e.id, e.name]));
  const interestEventCounts: Record<string, number> = {};
  const interestEventsBySignup: Record<string, string[]> = {};
  const interestPeopleByEvent: Record<string, string[]> = {};
  for (const interest of allInterests) {
    const ei = await db
      .select()
      .from(eventInterests)
      .where(eq(eventInterests.interestSignupId, interest.id));

    const displayName =
      interest.name ||
      [interest.firstName, interest.lastName].filter(Boolean).join(" ") ||
      interest.email;
    const personLabel = `${displayName} <${interest.email}>`;

    interestEventsBySignup[interest.id] = ei
      .map((e) => eventNameById.get(e.eventId))
      .filter((n): n is string => !!n);

    for (const e of ei) {
      interestEventCounts[e.eventId] = (interestEventCounts[e.eventId] || 0) + 1;
      if (!interestPeopleByEvent[e.eventId]) interestPeopleByEvent[e.eventId] = [];
      interestPeopleByEvent[e.eventId].push(personLabel);
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
      <BackLink fallbackHref={`/${slug}`} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <EditableSiteName reunionId={reunion.id} initialName={reunion.name} />
          {slug.endsWith("-test") && <TestTag size="md" />}
        </div>
        <LaunchSiteMenu
          slug={slug}
          reunionName={reunion.name}
          customDomain={reunion.customDomain}
        />
      </div>

      <SiteModeToggle
        reunionId={reunion.id}
        initialMode={reunion.siteMode}
        payoutsReady={!!connect?.chargesEnabled}
      />

      {/*
        Stripe Connect lives below Site Customization but auto-expands when
        not configured. The "you must set this up" emphasis lives on Site
        Mode (Open is gated on payouts) so the admin sees one clear path:
        try to switch to Open → SiteModeToggle tells them to configure
        payouts → they expand the Stripe Connect section right below.
      */}
      <CollapsibleCard
        title="Stripe Connect — Payouts"
        subtitle={
          !connect?.chargesEnabled
            ? "Required before the reunion can accept payments."
            : undefined
        }
        defaultOpen={!connect?.chargesEnabled}
        headerExtra={
          connect?.accountId ? (
            <InfoTooltip label="Stripe account info">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Stripe account ID
              </p>
              <p className="break-all font-mono text-ink">
                {connect.accountId}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Account name
              </p>
              <p className="break-words text-ink">
                {connectAccountName ?? (
                  <span className="text-ink-subtle">
                    Name unavailable — couldn&apos;t reach Stripe.
                  </span>
                )}
              </p>
              <p className="mt-2 text-ink-muted">
                For reference — use this to correlate this reunion with
                records in the Stripe dashboard, support tickets, or
                webhook logs.
              </p>
            </InfoTooltip>
          ) : undefined
        }
      >
        <ConnectStatus
          reunionId={reunion.id}
          slug={slug}
          connectedAccountId={connect?.accountId ?? null}
          initialHasAccount={!!connect}
          initialOnboardingComplete={!!connect?.detailsSubmitted}
          initialChargesEnabled={!!connect?.chargesEnabled}
          initialPayoutsEnabled={!!connect?.payoutsEnabled}
          requireDisconnectPassword={
            !!process.env.STRIPE_DISCONNECT_PASSWORD
          }
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Site Customization"
        subtitle="Custom domain, favicon, and brand color for the public reunion page."
        defaultOpen={
          !reunion.customDomain ||
          !reunion.faviconUrl ||
          !reunion.brandColor
        }
      >
        <SiteCustomization
          reunionId={reunion.id}
          initialCustomDomain={reunion.customDomain}
          initialFaviconUrl={reunion.faviconUrl}
          initialBrandColor={reunion.brandColor}
        />
      </CollapsibleCard>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-border-warm bg-white p-4 shadow-sm">
          <p className="text-sm text-ink-subtle">Confirmed</p>
          <p className="text-2xl font-bold">{paidRsvps.length}</p>
        </div>
        <div className="rounded-lg border border-border-warm bg-white p-4 shadow-sm">
          <p className="text-sm text-ink-subtle">Total Guests</p>
          <p className="text-2xl font-bold">{totalGuests}</p>
        </div>
        <div className="rounded-lg border border-border-warm bg-white p-4 shadow-sm">
          <p className="text-sm text-ink-subtle">Revenue</p>
          <p className="text-2xl font-bold">{formatCents(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-border-warm bg-white p-4 shadow-sm">
          <p className="text-sm text-ink-subtle">Fees Covered</p>
          <p className="text-2xl font-bold">{formatCents(totalFeesCovered)}</p>
        </div>
        <div className="rounded-lg border border-border-warm bg-white p-4 shadow-sm">
          <p className="text-sm text-ink-subtle">Sponsorships</p>
          <p className="text-2xl font-bold">
            {formatCents(totalSponsorRevenue)}
          </p>
        </div>
      </div>

      <AdminTabs
        slug={slug}
        reunionId={reunion.id}
        isSuper={ctx.isSuper}
        rsvps={allRsvps}
        interests={allInterests}
        sponsors={allSponsors}
        memorials={allMemorials}
        profiles={allProfiles}
        events={allEvents}
        messages={messages}
        interestEventCounts={interestEventCounts}
        interestEventsBySignup={interestEventsBySignup}
        interestPeopleByEvent={interestPeopleByEvent}
        regEventCounts={regEventCounts}
        categoryLabels={CATEGORY_LABELS}
      />
    </div>
  );
}
