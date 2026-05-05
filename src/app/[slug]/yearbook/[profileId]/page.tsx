import { db } from "@/lib/db";
import { reunions, profiles, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import Image from "next/image";

export default async function ProfileViewPage({
  params,
}: {
  params: Promise<{ slug: string; profileId: string }>;
}) {
  const { slug, profileId } = await params;

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
  if (!reunion) notFound();
  const effectiveMode = await getEffectiveSiteMode(reunion);
  if (effectiveMode === "tease") redirect(`/${slug}`);

  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .get();

  if (!profile || !profile.isPublished) notFound();

  const rsvp = await db
    .select()
    .from(rsvps)
    .where(eq(rsvps.id, profile.rsvpId))
    .get();

  if (!rsvp) notFound();

  const fields = [
    { label: "Where I live now", value: profile.currentCity },
    { label: "What I do", value: profile.occupation },
    { label: "Family", value: profile.family },
    { label: "Favorite Park Hill Memory", value: profile.favoritePHMemory },
    { label: "What I've been up to since '96", value: profile.beenUpTo },
    { label: "Fun Fact", value: profile.funFact },
  ];

  return (
    <div className="min-h-screen bg-bg-subtle py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}/yearbook`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to yearbook
        </Link>

        <div className="rounded-xl border border-border-warm bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            {profile.photoUrl ? (
              <Image
                src={profile.photoUrl}
                alt={`${rsvp.firstName} ${rsvp.lastName}`}
                width={200}
                height={200}
                className="mx-auto mb-4 h-40 w-40 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-full bg-tenant-tint-strong text-5xl font-bold text-tenant-primary">
                {rsvp.firstName[0]}
                {rsvp.lastName[0]}
              </div>
            )}
            <h1 className="text-2xl font-bold text-ink">
              {rsvp.firstName} {rsvp.lastName}
            </h1>
          </div>

          <div className="space-y-6">
            {fields.map(
              (field) =>
                field.value && (
                  <div key={field.label}>
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
                      {field.label}
                    </h3>
                    <p className="text-ink whitespace-pre-wrap">
                      {field.value}
                    </p>
                  </div>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
