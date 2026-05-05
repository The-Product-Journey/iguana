import { db } from "@/lib/db";
import { reunions, profiles, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function YearbookPage({
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

  // Get all published profiles with rsvp data
  const allProfiles = await db
    .select({
      profile: profiles,
      firstName: rsvps.firstName,
      lastName: rsvps.lastName,
    })
    .from(profiles)
    .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
    .where(eq(profiles.isPublished, true));

  return (
    <div className="min-h-screen bg-bg-subtle py-12">
      <div className="mx-auto max-w-4xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-ink">
              Digital Yearbook
            </h1>
            <p className="text-ink-muted">
              See what your classmates have been up to since &apos;96.
            </p>
          </div>
          <Link
            href={`/${slug}/yearbook/print`}
            className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-bg-subtle"
          >
            Print / PDF
          </Link>
        </div>

        {allProfiles.length === 0 ? (
          <div className="rounded-xl border border-border-warm bg-white p-12 text-center shadow-sm">
            <p className="text-ink-subtle">
              No profiles yet — be the first to fill yours out!
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allProfiles.map(({ profile, firstName, lastName }) => (
              <Link
                key={profile.id}
                href={`/${slug}/yearbook/${profile.id}`}
                className="rounded-xl border border-border-warm bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                {profile.photoUrl ? (
                  <Image
                    src={profile.photoUrl}
                    alt={`${firstName} ${lastName}`}
                    width={200}
                    height={200}
                    className="mb-4 h-32 w-32 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="mb-4 mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-tenant-tint-strong text-3xl font-bold text-tenant-primary">
                    {firstName[0]}
                    {lastName[0]}
                  </div>
                )}
                <h3 className="text-center text-lg font-bold text-ink">
                  {firstName} {lastName}
                </h3>
                {profile.currentCity && (
                  <p className="text-center text-sm text-ink-subtle">
                    {profile.currentCity}
                  </p>
                )}
                {profile.occupation && (
                  <p className="mt-1 text-center text-sm text-ink-muted">
                    {profile.occupation}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
