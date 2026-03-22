import { db } from "@/lib/db";
import { reunions, events } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import { formatCents } from "@/lib/utils";

export default async function SchedulePage({
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
  if (effectiveMode === "tease") redirect(`/${slug}`);

  const reunionEvents = await db
    .select()
    .from(events)
    .where(eq(events.reunionId, reunion.id))
    .orderBy(asc(events.sortOrder));

  // Group by date
  const eventsByDate = new Map<string, typeof reunionEvents>();
  for (const event of reunionEvents) {
    const existing = eventsByDate.get(event.eventDate) || [];
    existing.push(event);
    eventsByDate.set(event.eventDate, existing);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>

        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Event Schedule
          </h1>
          <p className="text-gray-600">
            A full weekend of reconnecting, celebrating, and giving back.
          </p>
        </div>

        <div className="space-y-10">
          {Array.from(eventsByDate.entries()).map(([date, dayEvents]) => (
            <div key={date}>
              <h2 className="mb-4 text-lg font-semibold text-red-800">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
              <div className="space-y-4">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {event.name}
                        </h3>
                        {event.eventTime && (
                          <p className="mt-1 text-sm text-gray-500">
                            {event.eventTime}
                          </p>
                        )}
                        {event.eventLocation && (
                          <p className="text-sm text-gray-500">
                            {event.eventLocation}
                            {event.eventAddress && ` — ${event.eventAddress}`}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                          event.type === "paid"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {event.type === "paid"
                          ? event.priceCents
                            ? formatCents(event.priceCents)
                            : "Ticketed"
                          : "Free"}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-3 text-sm text-gray-600">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href={`/${slug}/rsvp`}
            className="inline-block rounded-full bg-red-700 px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800"
          >
            Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
