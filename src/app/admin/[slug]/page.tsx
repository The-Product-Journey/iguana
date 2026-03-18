import { db } from "@/lib/db";
import { reunions, rsvps, contactMessages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { RegistrationToggle } from "@/components/registration-toggle";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  volunteer: "Volunteer",
  photos: "Photos",
  entertainment: "Entertainment",
  classmate_passed: "Classmate Passed",
  other: "Other",
};

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

  const allRsvps = await db
    .select()
    .from(rsvps)
    .where(eq(rsvps.reunionId, reunion.id))
    .orderBy(desc(rsvps.createdAt));

  const messages = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.reunionId, reunion.id))
    .orderBy(desc(contactMessages.createdAt));

  const paidRsvps = allRsvps.filter((r) => r.paymentStatus === "paid");
  const totalRevenue = paidRsvps.reduce(
    (sum, r) => sum + (r.amountPaidCents || 0),
    0
  );
  const totalDonations = paidRsvps.reduce(
    (sum, r) => sum + (r.donationCents || 0),
    0
  );
  const totalGuests = paidRsvps.reduce((sum, r) => sum + r.guestCount, 0);

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm text-red-700 hover:text-red-800"
      >
        &larr; Back to dashboard
      </Link>

      <h2 className="mb-4 text-2xl font-bold">{reunion.name}</h2>

      <RegistrationToggle
        reunionId={reunion.id}
        initialOpen={reunion.registrationOpen}
      />

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          <p className="text-sm text-gray-500">Donations</p>
          <p className="text-2xl font-bold">{formatCents(totalDonations)}</p>
        </div>
      </div>

      {/* RSVP table */}
      <h3 className="mb-3 text-lg font-semibold">RSVPs</h3>
      <div className="mb-10 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Email</th>
              <th className="px-4 py-3 font-medium text-gray-700">Guests</th>
              <th className="px-4 py-3 font-medium text-gray-700">Paid</th>
              <th className="px-4 py-3 font-medium text-gray-700">Donation</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allRsvps.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No RSVPs yet.
                </td>
              </tr>
            ) : (
              allRsvps.map((rsvp) => (
                <tr key={rsvp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {rsvp.firstName} {rsvp.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{rsvp.email}</td>
                  <td className="px-4 py-3">{rsvp.guestCount}</td>
                  <td className="px-4 py-3">
                    {formatCents(rsvp.amountPaidCents || 0)}
                  </td>
                  <td className="px-4 py-3">
                    {(rsvp.donationCents || 0) > 0
                      ? formatCents(rsvp.donationCents!)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        rsvp.paymentStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : rsvp.paymentStatus === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {rsvp.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(rsvp.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Contact Messages */}
      <h3 className="mb-3 text-lg font-semibold">
        Contact Messages ({messages.length})
      </h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Email</th>
              <th className="px-4 py-3 font-medium text-gray-700">Category</th>
              <th className="px-4 py-3 font-medium text-gray-700">Message</th>
              <th className="px-4 py-3 font-medium text-gray-700">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {messages.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No messages yet.
                </td>
              </tr>
            ) : (
              messages.map((msg) => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{msg.name}</td>
                  <td className="px-4 py-3 text-gray-600">{msg.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {CATEGORY_LABELS[msg.category] || msg.category}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-600 truncate">
                    {msg.message}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
