import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { requireReunionAdminPage } from "@/lib/admin-auth";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
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

  // Page-level scope guard. requireReunionAdminPage redirects super
  // admins through; reunion admins must own this reunion.
  const ctx = await requireReunionAdminPage(reunion.id);
  const isSuper = ctx.isSuper;

  return (
    <div>
      <Link
        href={`/admin/${slug}`}
        className="mb-4 inline-block text-sm text-red-700 hover:text-red-800"
      >
        &larr; Back to {reunion.name}
      </Link>

      <h2 className="mb-2 text-2xl font-bold">Reunion settings</h2>
      <p className="mb-6 max-w-xl text-sm text-gray-600">
        Update identity, copy, and branding for this reunion. Changes take
        effect immediately on the public site.
      </p>

      <SettingsClient
        reunion={{
          id: reunion.id,
          slug: reunion.slug,
          name: reunion.name,
          description: reunion.description,
          eventDate: reunion.eventDate,
          registrationFeeCents: reunion.registrationFeeCents,
          isActive: reunion.isActive,
          orgName: reunion.orgName,
          orgShortName: reunion.orgShortName,
          mascot: reunion.mascot,
          classYear: reunion.classYear,
          reunionMilestoneLabel: reunion.reunionMilestoneLabel,
          brandColorPrimary: reunion.brandColorPrimary,
          brandColorPrimaryDark: reunion.brandColorPrimaryDark,
          logoUrl: reunion.logoUrl,
          communityServiceProjectName: reunion.communityServiceProjectName,
          communityServiceCharityName: reunion.communityServiceCharityName,
          communityServiceTeaserCopy: reunion.communityServiceTeaserCopy,
          communityServiceFullCopy: reunion.communityServiceFullCopy,
          sponsorTopTierLabel: reunion.sponsorTopTierLabel,
          sponsorCommunityTierLabel: reunion.sponsorCommunityTierLabel,
          favoriteMemoryLabel: reunion.favoriteMemoryLabel,
          banquetLabel: reunion.banquetLabel,
        }}
        isSuper={isSuper}
      />
    </div>
  );
}
