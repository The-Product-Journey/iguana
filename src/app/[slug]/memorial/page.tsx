import { db } from "@/lib/db";
import { reunions, memorials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function MemorialPage({
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

  const published = await db
    .select()
    .from(memorials)
    .where(
      and(
        eq(memorials.reunionId, reunion.id),
        eq(memorials.status, "published")
      )
    );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            In Memoriam
          </h1>
          <p className="text-gray-600">
            Remembering our classmates who are no longer with us.
          </p>
        </div>

        {published.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500">
              No memorial entries yet.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {published.map((memorial) => {
              // Use admin draft if available, otherwise original submission
              const display = memorial.adminDraft
                ? JSON.parse(memorial.adminDraft)
                : memorial;

              return (
                <div
                  key={memorial.id}
                  className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
                >
                  <div className="flex gap-6">
                    {(display.deceasedPhotoUrl || memorial.deceasedPhotoUrl) && (
                      <Image
                        src={display.deceasedPhotoUrl || memorial.deceasedPhotoUrl!}
                        alt={`${display.deceasedFirstName || memorial.deceasedFirstName} ${display.deceasedLastName || memorial.deceasedLastName}`}
                        width={120}
                        height={120}
                        className="h-28 w-28 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {display.deceasedFirstName || memorial.deceasedFirstName}{" "}
                        {display.deceasedLastName || memorial.deceasedLastName}
                      </h2>
                      {(display.yearOfBirth || memorial.yearOfBirth) &&
                        (display.yearOfDeath || memorial.yearOfDeath) && (
                          <p className="mt-1 text-sm text-gray-500">
                            {display.yearOfBirth || memorial.yearOfBirth} –{" "}
                            {display.yearOfDeath || memorial.yearOfDeath}
                          </p>
                        )}
                      <p className="mt-3 text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {display.tributeText || memorial.tributeText}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="mb-3 text-sm text-gray-500">
            Know of a classmate who should be remembered here?
          </p>
          <Link
            href={`/${slug}/memorial/submit`}
            className="inline-block rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Submit a Memorial
          </Link>
        </div>
      </div>
    </div>
  );
}
