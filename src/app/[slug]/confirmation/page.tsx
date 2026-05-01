import { db } from "@/lib/db";
import { reunions, rsvps, registrationEvents, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { getStripe } from "@/lib/stripe";
import { REFUND_POLICY_TEXT } from "@/lib/constants";
import { getTenantConfig } from "@/lib/tenant-config";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; token?: string }>;
}) {
  const { slug } = await params;
  const { session_id, token } = await searchParams;

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (!reunion) notFound();

  let rsvp = null;
  let editToken: string | null = null;

  // Paid registration — look up via Stripe session.
  // Cross-tenant scope: drop the rsvp if it belongs to a different reunion
  // than the URL slug. Mismatch is treated like "not found" — same UX,
  // doesn't leak existence-in-other-tenant via response timing.
  if (session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      if (session.metadata?.rsvp_id) {
        const candidate = await db
          .select()
          .from(rsvps)
          .where(eq(rsvps.id, session.metadata.rsvp_id))
          .get();
        if (candidate && candidate.reunionId === reunion.id) {
          rsvp = candidate;
          editToken = candidate.editToken ?? null;
        }
      }
    } catch {
      // Session not found or invalid
    }
  }

  // Pay-later registration — look up via edit token. Same cross-tenant
  // scope: an editToken from reunion B must not surface confirmation
  // under reunion A's URL.
  if (!rsvp && token) {
    const candidate = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.editToken, token))
      .get();
    if (candidate && candidate.reunionId === reunion.id) {
      rsvp = candidate;
      editToken = token;
    }
  }

  // Get selected events
  let selectedEvents: { name: string; eventDate: string; eventTime: string | null }[] = [];
  if (rsvp) {
    const regEvents = await db
      .select({ eventId: registrationEvents.eventId })
      .from(registrationEvents)
      .where(eq(registrationEvents.rsvpId, rsvp.id));

    if (regEvents.length > 0) {
      const eventIds = regEvents.map((re) => re.eventId);
      const allEvents = await db.select().from(events).where(eq(events.reunionId, reunion.id));
      selectedEvents = allEvents
        .filter((e) => eventIds.includes(e.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({ name: e.name, eventDate: e.eventDate, eventTime: e.eventTime }));
    }
  }

  const isPaid = rsvp?.paymentMethod === "online";
  const tenantConfig = getTenantConfig(reunion);
  // Heading: keep mascot reference when the tenant has one configured (it's
  // a nice flourish for PHHS-style "You're All Set, Trojan!"), otherwise
  // fall back to a clean generic.
  const headingTail = tenantConfig.mascot ? `, ${tenantConfig.mascot}!` : "!";
  const reunionFullName = tenantConfig.reunionMilestoneLabel
    ? `${tenantConfig.orgName} ${tenantConfig.reunionMilestoneLabel}`
    : `${tenantConfig.orgName} reunion`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-6xl">🎉</div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          You&apos;re All Set{headingTail}
        </h1>

        {rsvp ? (
          <div className="mb-8 space-y-2 text-gray-600">
            <p>
              Thanks, <strong>{rsvp.firstName}</strong>! Your registration for{" "}
              {reunionFullName} has been confirmed.
            </p>
            {isPaid && (rsvp.amountPaidCents || 0) > 0 && (
              <p>
                {rsvp.guestCount}{" "}
                {rsvp.guestCount === 1 ? "guest" : "guests"} —{" "}
                {formatCents(rsvp.amountPaidCents || 0)} paid
              </p>
            )}
            {!isPaid && (
              <p>
                You selected pay at the door — we&apos;ll see you there!
              </p>
            )}
            {(rsvp.donationCents || 0) > 0 && (
              <p className="text-red-700">
                Thanks for covering {formatCents(rsvp.donationCents!)} in
                processing fees!
              </p>
            )}
          </div>
        ) : (
          <p className="mb-8 text-gray-600">
            Your payment is being processed. You&apos;ll receive a confirmation
            email from Stripe shortly.
          </p>
        )}

        {/* Selected events */}
        {selectedEvents.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-900">
              Your Events
            </h3>
            <ul className="space-y-2">
              {selectedEvents.map((event, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="font-medium">{event.name}</span>
                  <span className="ml-2 text-gray-500">
                    {event.eventDate}
                    {event.eventTime && ` · ${event.eventTime}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Yearbook profile CTA */}
        {editToken && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-left">
            <h3 className="mb-2 font-semibold text-red-900">
              Be in the Digital Yearbook!
            </h3>
            <p className="mb-3 text-sm text-red-800">
              Share what you&apos;ve been up to. Your classmates would love
              to hear from you.
            </p>
            <Link
              href={`/${slug}/profile/${editToken}`}
              className="inline-block rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Fill Out Your Profile
            </Link>
            <p className="mt-2 text-xs text-red-600">
              You can always come back to this later — bookmark this page!
            </p>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Event Details</h3>
          <p className="text-gray-700">August 28–29, 2026</p>
          <p className="text-gray-600">Friday &amp; Saturday</p>
          <p className="mt-2 text-gray-700">
            Saturday Banquet: {reunion.eventLocation}
          </p>
          {reunion.eventAddress && (
            <p className="text-gray-600">{reunion.eventAddress}</p>
          )}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Questions? Email{" "}
          <a
            href="mailto:parkhill1996reunion@gmail.com"
            className="text-red-700 underline hover:text-red-800"
          >
            parkhill1996reunion@gmail.com
          </a>
        </p>

        <Link
          href={`/${slug}`}
          className="mt-4 inline-block text-red-700 hover:text-red-800"
        >
          &larr; Back to event page
        </Link>

        {isPaid && (
          <p className="mt-6 text-xs text-gray-400">{REFUND_POLICY_TEXT}</p>
        )}
      </div>
    </div>
  );
}
