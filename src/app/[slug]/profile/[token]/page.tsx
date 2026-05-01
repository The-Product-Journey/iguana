import { db } from "@/lib/db";
import { rsvps, profiles, reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { getTenantConfig } from "@/lib/tenant-config";

export default async function ProfileEditPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
  if (!reunion) notFound();

  const rsvp = await db
    .select()
    .from(rsvps)
    .where(eq(rsvps.editToken, token))
    .get();

  if (!rsvp || rsvp.reunionId !== reunion.id) notFound();

  // Look up existing profile (may not exist yet — created on first save)
  const existingProfile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.rsvpId, rsvp.id))
    .get();

  const tenantConfig = getTenantConfig(reunion);
  const sinceLabel = tenantConfig.classYear
    ? `since '${tenantConfig.classYear.slice(-2)}`
    : "lately";

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Your Digital Yearbook Profile
          </h1>
          <p className="mt-2 text-gray-600">
            Hey {rsvp.firstName}! Tell your classmates what you&apos;ve been up
            to {sinceLabel}. All fields are optional — fill in as much or as
            little as you&apos;d like.
          </p>
        </div>

        <ProfileForm
          rsvpId={rsvp.id}
          editToken={token}
          favoriteMemoryLabel={tenantConfig.favoriteMemoryLabel}
          existingProfile={
            existingProfile
              ? {
                  currentCity: existingProfile.currentCity,
                  occupation: existingProfile.occupation,
                  family: existingProfile.family,
                  favoriteSchoolMemory: existingProfile.favoriteSchoolMemory,
                  favoritePHMemory: existingProfile.favoritePHMemory,
                  beenUpTo: existingProfile.beenUpTo,
                  funFact: existingProfile.funFact,
                  photoUrl: existingProfile.photoUrl,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
