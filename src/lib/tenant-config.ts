/**
 * Tenant config reader — wraps a `Reunion` row with branding/copy fields
 * resolved against generic defaults.
 *
 * Why a wrapper instead of using `reunion.*` directly: most fields are
 * nullable (added in Phase 1 of the multi-tenant work) so existing rows
 * survive `drizzle-kit push` without backfill. Callers shouldn't sprinkle
 * `??` everywhere — they read `getTenantConfig(reunion).orgShortName` and
 * always get a non-null string.
 *
 * Defaults are intentionally generic — a fresh tenant with nothing
 * customized renders as a plausibly-blank reunion site, not as PHHS.
 * The live PHHS reunion gets its values populated by
 * `src/lib/db/backfill-phhs-config.ts` so its public site is unchanged.
 */
import type { Reunion } from "@/lib/db/schema";

export type TenantConfig = {
  // Identity
  orgName: string;
  orgShortName: string;
  mascot: string | null;
  classYear: string | null;
  reunionMilestoneLabel: string | null;

  // Branding
  brandColorPrimary: string;
  brandColorPrimaryDark: string;
  logoUrl: string | null;

  // Community service block
  hasCommunityServiceProject: boolean;
  communityServiceProjectName: string | null;
  communityServiceCharityName: string | null;
  communityServiceTeaserCopy: string | null;
  communityServiceFullCopy: string | null;

  // Sponsor tier labels
  sponsorTopTierLabel: string;
  sponsorCommunityTierLabel: string;

  // Yearbook + landing copy
  favoriteMemoryLabel: string;
  banquetLabel: string;
};

// Defaults — used when a tenant hasn't been customized. Generic / neutral.
// Brand colors stay red so the unstyled fallback matches the historic look.
const DEFAULTS = {
  brandColorPrimary: "#b91c1c", // tailwind red-700
  brandColorPrimaryDark: "#7f1d1d", // tailwind red-900
  sponsorTopTierLabel: "Top",
  sponsorCommunityTierLabel: "Community",
  favoriteMemoryLabel: "Favorite School Memory",
  banquetLabel: "Banquet",
} as const;

export function getTenantConfig(reunion: Reunion): TenantConfig {
  const orgName = reunion.orgName ?? reunion.name;
  const orgShortName = reunion.orgShortName ?? reunion.orgName ?? reunion.name;
  return {
    orgName,
    orgShortName,
    mascot: reunion.mascot ?? null,
    classYear: reunion.classYear ?? null,
    reunionMilestoneLabel: reunion.reunionMilestoneLabel ?? null,

    brandColorPrimary:
      reunion.brandColorPrimary ?? DEFAULTS.brandColorPrimary,
    brandColorPrimaryDark:
      reunion.brandColorPrimaryDark ?? DEFAULTS.brandColorPrimaryDark,
    logoUrl: reunion.logoUrl ?? null,

    hasCommunityServiceProject: !!reunion.communityServiceProjectName,
    communityServiceProjectName: reunion.communityServiceProjectName ?? null,
    communityServiceCharityName: reunion.communityServiceCharityName ?? null,
    communityServiceTeaserCopy: reunion.communityServiceTeaserCopy ?? null,
    communityServiceFullCopy: reunion.communityServiceFullCopy ?? null,

    sponsorTopTierLabel:
      reunion.sponsorTopTierLabel ?? DEFAULTS.sponsorTopTierLabel,
    sponsorCommunityTierLabel:
      reunion.sponsorCommunityTierLabel ?? DEFAULTS.sponsorCommunityTierLabel,

    favoriteMemoryLabel:
      reunion.favoriteMemoryLabel ?? DEFAULTS.favoriteMemoryLabel,
    banquetLabel: reunion.banquetLabel ?? DEFAULTS.banquetLabel,
  };
}
