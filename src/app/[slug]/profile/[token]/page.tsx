import { db } from "@/lib/db";
import { rsvps, profiles, reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";

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

  return (
    <div className="min-h-screen bg-tenant-tint py-12">
      <div className="mx-auto max-w-xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink">
            Your Digital Yearbook Profile
          </h1>
          <p className="mt-2 text-ink-muted">
            Hey {rsvp.firstName}! Tell your classmates what you&apos;ve been up
            to since &apos;96. All fields are optional — fill in as much or as
            little as you&apos;d like.
          </p>
        </div>

        <ProfileForm
          rsvpId={rsvp.id}
          editToken={token}
          existingProfile={
            existingProfile
              ? {
                  currentCity: existingProfile.currentCity,
                  occupation: existingProfile.occupation,
                  family: existingProfile.family,
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
