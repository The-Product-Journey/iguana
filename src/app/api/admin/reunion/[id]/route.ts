/**
 * Tenant settings PATCH endpoint.
 *
 * Updates editable tenant-config fields on a reunion. Two field tiers:
 *   - Reunion-admin editable: identity, branding, copy fields
 *     (orgName, mascot, tier labels, community-service block, etc.)
 *   - Super-admin only: `isActive` (soft-delete lever) and anything that
 *     could affect platform-wide visibility. `slug` is intentionally
 *     immutable here — public URLs would break across cached links and
 *     Stripe Connect return URLs if a slug changed mid-flight.
 *
 * Auth: route-level requireReunionAdmin(reunionId). The handler then
 * filters the body so reunion admins can only set fields in the lower
 * tier; super-admin-only fields are silently dropped from the update if
 * the caller isn't a super admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { requireReunionAdmin } from "@/lib/admin-auth";

type SettingsPatchBody = {
  // Reunion-admin editable
  name?: string;
  description?: string | null;
  eventDate?: string;
  registrationFeeCents?: number;
  orgName?: string | null;
  orgShortName?: string | null;
  mascot?: string | null;
  classYear?: string | null;
  reunionMilestoneLabel?: string | null;
  brandColorPrimary?: string | null;
  brandColorPrimaryDark?: string | null;
  logoUrl?: string | null;
  communityServiceProjectName?: string | null;
  communityServiceCharityName?: string | null;
  communityServiceTeaserCopy?: string | null;
  communityServiceFullCopy?: string | null;
  sponsorTopTierLabel?: string | null;
  sponsorCommunityTierLabel?: string | null;
  favoriteMemoryLabel?: string | null;
  banquetLabel?: string | null;
  // Super-only
  isActive?: boolean;
};

const REUNION_ADMIN_FIELDS = new Set<keyof SettingsPatchBody>([
  "name",
  "description",
  "eventDate",
  "registrationFeeCents",
  "orgName",
  "orgShortName",
  "mascot",
  "classYear",
  "reunionMilestoneLabel",
  "brandColorPrimary",
  "brandColorPrimaryDark",
  "logoUrl",
  "communityServiceProjectName",
  "communityServiceCharityName",
  "communityServiceTeaserCopy",
  "communityServiceFullCopy",
  "sponsorTopTierLabel",
  "sponsorCommunityTierLabel",
  "favoriteMemoryLabel",
  "banquetLabel",
]);
const SUPER_ADMIN_FIELDS = new Set<keyof SettingsPatchBody>(["isActive"]);

function normalizeStringField(v: unknown): string | null | undefined {
  if (v === undefined) return undefined; // not in body → leave alone
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await requireReunionAdmin(id);
  if (guard instanceof NextResponse) return guard;

  let body: Partial<SettingsPatchBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  // Reunion-admin tier
  for (const key of REUNION_ADMIN_FIELDS) {
    if (!(key in body)) continue;
    if (key === "registrationFeeCents") {
      const v = body.registrationFeeCents;
      if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
        updates.registrationFeeCents = v;
      }
      continue;
    }
    if (key === "name" || key === "eventDate") {
      // Required-ish — empty would degrade rendering.
      const normalized = normalizeStringField(body[key]);
      if (typeof normalized === "string" && normalized.length > 0) {
        if (
          key === "eventDate" &&
          !/^\d{4}-\d{2}-\d{2}$/.test(normalized)
        ) {
          return NextResponse.json(
            { error: "eventDate must be YYYY-MM-DD" },
            { status: 400 }
          );
        }
        updates[key] = normalized;
      }
      continue;
    }
    const normalized = normalizeStringField(body[key]);
    if (normalized !== undefined) {
      updates[key] = normalized;
    }
  }

  // Super-admin tier — drop silently if caller isn't super.
  if (guard.isSuper) {
    for (const key of SUPER_ADMIN_FIELDS) {
      if (!(key in body)) continue;
      if (key === "isActive") {
        if (typeof body.isActive === "boolean") {
          updates.isActive = body.isActive;
        }
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No editable fields in request body." },
      { status: 400 }
    );
  }

  updates.updatedAt = new Date().toISOString();

  await db
    .update(reunions)
    .set(updates)
    .where(eq(reunions.id, id));

  const refreshed = await db
    .select()
    .from(reunions)
    .where(eq(reunions.id, id))
    .get();

  return NextResponse.json({ ok: true, reunion: refreshed });
}
