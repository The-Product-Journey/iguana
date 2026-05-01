import { db } from "@/lib/db";
import { reunions, profiles, rsvps } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "./print-button";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

export default async function YearbookPrintPage({
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

  const allProfiles = await db
    .select({
      profile: profiles,
      firstName: rsvps.firstName,
      lastName: rsvps.lastName,
    })
    .from(profiles)
    .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
    .where(
      and(
        eq(rsvps.reunionId, reunion.id),
        eq(profiles.isPublished, true)
      )
    );

  // Sort alphabetically by last name
  allProfiles.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );

  const tenantConfig = getTenantConfig(reunion);
  // Format the cover date the same way the homepage card does (Phase 3.6).
  const start = new Date(`${reunion.eventDate}T00:00:00Z`);
  const coverDate = isNaN(start.getTime())
    ? reunion.eventDate
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(start);

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { font-size: 11pt; }
              .no-print { display: none !important; }
              .profile-entry { break-inside: avoid; }
            }
          `,
        }}
      />

      <div className="no-print mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Use your browser&apos;s Print function (Ctrl+P / Cmd+P) to save this as
        a PDF.
        <PrintButton />
      </div>

      {/* Cover */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{reunion.name}</h1>
        <p className="mt-2 text-xl text-gray-600">
          {tenantConfig.reunionMilestoneLabel
            ? `${tenantConfig.reunionMilestoneLabel} — Digital Yearbook`
            : "Digital Yearbook"}
        </p>
        <p className="mt-1 text-gray-500">{coverDate}</p>
        <p className="mt-4 text-sm text-gray-400">
          {allProfiles.length} classmates
        </p>
      </div>

      {/* Profiles */}
      <div className="space-y-8">
        {allProfiles.map(({ profile, firstName, lastName }) => (
          <div
            key={profile.id}
            className="profile-entry border-b border-gray-200 pb-6"
          >
            <div className="flex gap-6">
              {profile.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt={`${firstName} ${lastName}`}
                  className="h-24 w-24 shrink-0 rounded-full object-cover"
                />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {firstName} {lastName}
                </h2>
                {profile.currentCity && (
                  <p className="text-sm text-gray-500">{profile.currentCity}</p>
                )}
                {profile.occupation && (
                  <p className="text-sm text-gray-600">{profile.occupation}</p>
                )}
                {profile.family && (
                  <p className="mt-2 text-sm text-gray-700">
                    <strong>Family:</strong> {profile.family}
                  </p>
                )}
                {(profile.favoriteSchoolMemory ||
                  profile.favoritePHMemory) && (
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>Favorite Memory:</strong>{" "}
                    {profile.favoriteSchoolMemory ?? profile.favoritePHMemory}
                  </p>
                )}
                {profile.beenUpTo && (
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>Since high school:</strong> {profile.beenUpTo}
                  </p>
                )}
                {profile.funFact && (
                  <p className="mt-1 text-sm text-gray-700">
                    <strong>Fun Fact:</strong> {profile.funFact}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
