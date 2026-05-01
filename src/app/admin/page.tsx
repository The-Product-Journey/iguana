import { db } from "@/lib/db";
import { reunions, rsvps } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { formatCents } from "@/lib/utils";
import { LaunchIcon } from "@/components/launch-icon";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const allReunions = await db.select().from(reunions);

  const stats = await Promise.all(
    allReunions.map(async (reunion) => {
      const result = await db
        .select({
          totalRsvps: sql<number>`count(*)`,
          paidRsvps: sql<number>`sum(case when ${rsvps.paymentStatus} = 'paid' then 1 else 0 end)`,
          totalRevenue: sql<number>`sum(case when ${rsvps.paymentStatus} = 'paid' then ${rsvps.amountPaidCents} else 0 end)`,
          totalFeesCovered: sql<number>`sum(case when ${rsvps.paymentStatus} = 'paid' then ${rsvps.donationCents} else 0 end)`,
          totalGuests: sql<number>`sum(case when ${rsvps.paymentStatus} = 'paid' then ${rsvps.guestCount} else 0 end)`,
        })
        .from(rsvps)
        .where(eq(rsvps.reunionId, reunion.id))
        .get();

      return { reunion, stats: result };
    })
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Dashboard</h2>

      {stats.length === 0 ? (
        <p className="text-gray-500">No reunions yet.</p>
      ) : (
        <div className="space-y-4">
          {stats.map(({ reunion, stats: s }) => (
            <div
              key={reunion.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              {/* Title row: link-to-admin text + inline launch icon.
                  Two separate <a>s side-by-side — no nested links. */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/${reunion.slug}`}
                  className="text-lg font-semibold text-gray-900 hover:text-red-700"
                >
                  {reunion.name}
                </Link>
                <a
                  href={`/${reunion.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open public site in new tab"
                  aria-label={`Open ${reunion.name} public site in new tab`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <LaunchIcon />
                </a>
              </div>
              <Link
                href={`/admin/${reunion.slug}`}
                className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"
              >
                <div>
                  <p className="text-gray-500">Confirmed RSVPs</p>
                  <p className="text-xl font-semibold">{s?.paidRsvps || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Guests</p>
                  <p className="text-xl font-semibold">{s?.totalGuests || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Revenue</p>
                  <p className="text-xl font-semibold">
                    {formatCents(s?.totalRevenue || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Fees Covered</p>
                  <p className="text-xl font-semibold">
                    {formatCents(s?.totalFeesCovered || 0)}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
