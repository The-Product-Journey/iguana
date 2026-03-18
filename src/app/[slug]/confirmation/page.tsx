import { db } from "@/lib/db";
import { reunions, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { getStripe } from "@/lib/stripe";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (!reunion) notFound();

  let rsvp = null;
  if (session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      if (session.metadata?.rsvp_id) {
        rsvp = await db
          .select()
          .from(rsvps)
          .where(eq(rsvps.id, session.metadata.rsvp_id))
          .get();
      }
    } catch {
      // Session not found or invalid
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-6xl">🎉</div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          You&apos;re All Set, Trojan!
        </h1>

        {rsvp ? (
          <div className="mb-8 space-y-2 text-gray-600">
            <p>
              Thanks, <strong>{rsvp.firstName}</strong>! Your RSVP for the PHHS
              Class of &apos;96 reunion has been confirmed.
            </p>
            <p>
              {rsvp.guestCount} {rsvp.guestCount === 1 ? "guest" : "guests"} —{" "}
              {formatCents(rsvp.amountPaidCents || 0)} paid
            </p>
            {(rsvp.donationCents || 0) > 0 && (
              <p className="text-red-700">
                Thanks for covering {formatCents(rsvp.donationCents!)} in processing fees!
              </p>
            )}
          </div>
        ) : (
          <p className="mb-8 text-gray-600">
            Your payment is being processed. You&apos;ll receive a confirmation
            email from Stripe shortly.
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Event Details</h3>
          <p className="text-gray-700">August 28–29, 2026</p>
          <p className="text-gray-600">Friday &amp; Saturday</p>
          <p className="mt-2 text-gray-700">Saturday Banquet: {reunion.eventLocation}</p>
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
      </div>
    </div>
  );
}
