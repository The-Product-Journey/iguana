/**
 * Super-admin Create Tenant endpoint.
 *
 * Inserts a fresh `reunions` row, optionally seeds it with the generic
 * demo dataset (`seedDemoTenant`), and optionally pre-assigns a first
 * reunion-admin (`reunion_admins` row). Wrapped in a transaction so a
 * partial failure doesn't leave a stub reunion behind.
 *
 * Wire-format: JSON. The shape mirrors the create form (Phase 4.2/4.3).
 *
 * Auth: super-admin only. The proxy already gates `/api/admin/*` for
 * signed-in status; the role check happens here.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions, reunionAdmins } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { validateSlug } from "@/lib/tenant-slug";
import { seedDemoTenant, TenantNotEmptyError } from "@/lib/db/seed-demo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepted body fields. Anything not in this list is dropped — keeps the
// surface narrow and prevents accidental writes to columns like `isActive`
// or `siteMode` from this endpoint (those have dedicated routes).
type CreateReunionBody = {
  // Required
  slug: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  // Tenant identity (optional — getTenantConfig defaults cover unset)
  orgName?: string;
  orgShortName?: string;
  mascot?: string;
  classYear?: string;
  reunionMilestoneLabel?: string;
  // Branding (optional)
  brandColorPrimary?: string;
  brandColorPrimaryDark?: string;
  logoUrl?: string;
  // Community service block (optional — set communityServiceProjectName
  // to opt the tenant into the homepage block + page)
  communityServiceProjectName?: string;
  communityServiceCharityName?: string;
  communityServiceTeaserCopy?: string;
  communityServiceFullCopy?: string;
  // Sponsor + yearbook copy
  sponsorTopTierLabel?: string;
  sponsorCommunityTierLabel?: string;
  favoriteMemoryLabel?: string;
  banquetLabel?: string;
  // Misc
  description?: string;
  registrationFeeCents?: number;
  // Behavior
  withDemoData?: boolean;
  firstAdminEmail?: string;
};

function pickStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: Partial<CreateReunionBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = pickStr(body.slug);
  const name = pickStr(body.name);
  const eventDate = pickStr(body.eventDate);

  if (!slug || !name || !eventDate) {
    return NextResponse.json(
      { error: "slug, name, and eventDate are required" },
      { status: 400 }
    );
  }

  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) {
    return NextResponse.json({ error: slugCheck.reason }, { status: 400 });
  }

  // ISO date check — a malformed date would render badly on every page.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json(
      { error: "eventDate must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const firstAdminEmail = pickStr(body.firstAdminEmail)?.toLowerCase();
  if (firstAdminEmail && !EMAIL_RE.test(firstAdminEmail)) {
    return NextResponse.json(
      { error: "firstAdminEmail is not a valid email address" },
      { status: 400 }
    );
  }

  const withDemoData = body.withDemoData === true;
  const registrationFeeCents =
    typeof body.registrationFeeCents === "number" &&
    Number.isInteger(body.registrationFeeCents) &&
    body.registrationFeeCents >= 0
      ? body.registrationFeeCents
      : undefined;

  // Build the insert row. Strings are pickStr'd to canonicalize empty as
  // undefined → not set. The schema columns are nullable so unset fields
  // remain null and getTenantConfig falls back to defaults.
  const insertValues = {
    slug,
    name,
    eventDate,
    description: pickStr(body.description) ?? null,
    registrationFeeCents,
    orgName: pickStr(body.orgName) ?? null,
    orgShortName: pickStr(body.orgShortName) ?? null,
    mascot: pickStr(body.mascot) ?? null,
    classYear: pickStr(body.classYear) ?? null,
    reunionMilestoneLabel: pickStr(body.reunionMilestoneLabel) ?? null,
    brandColorPrimary: pickStr(body.brandColorPrimary) ?? null,
    brandColorPrimaryDark: pickStr(body.brandColorPrimaryDark) ?? null,
    logoUrl: pickStr(body.logoUrl) ?? null,
    communityServiceProjectName:
      pickStr(body.communityServiceProjectName) ?? null,
    communityServiceCharityName:
      pickStr(body.communityServiceCharityName) ?? null,
    communityServiceTeaserCopy:
      pickStr(body.communityServiceTeaserCopy) ?? null,
    communityServiceFullCopy: pickStr(body.communityServiceFullCopy) ?? null,
    sponsorTopTierLabel: pickStr(body.sponsorTopTierLabel) ?? null,
    sponsorCommunityTierLabel:
      pickStr(body.sponsorCommunityTierLabel) ?? null,
    favoriteMemoryLabel: pickStr(body.favoriteMemoryLabel) ?? null,
    banquetLabel: pickStr(body.banquetLabel) ?? null,
    siteMode: "tease" as const,
    isActive: true,
  };

  // Two-step create. The first transaction inserts the reunion + (optional)
  // first reunion-admin row atomically. The demo-seed step runs separately
  // because seedDemoTenant uses its own db.transaction() and libsql doesn't
  // support nested transactions. If the demo seed fails after the reunion
  // commits, the operator sees the reunion and can re-run the seed via
  // /admin/[slug]/settings → "Re-seed with demo data" (Phase 5).
  let createdId: string;
  let createdSlug: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [reunion] = await tx
        .insert(reunions)
        .values(insertValues)
        .returning();

      if (firstAdminEmail) {
        await tx.insert(reunionAdmins).values({
          reunionId: reunion.id,
          email: firstAdminEmail,
          invitedByEmail: guard.email,
        });
      }

      return reunion;
    });
    createdId = result.id;
    createdSlug = result.slug;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") && msg.toLowerCase().includes("slug")) {
      return NextResponse.json(
        { error: "That slug is already in use." },
        { status: 409 }
      );
    }
    console.error("[create-reunion] insert failed", err);
    return NextResponse.json(
      { error: "Failed to create reunion." },
      { status: 500 }
    );
  }

  if (withDemoData) {
    try {
      await seedDemoTenant(db, createdId);
    } catch (err) {
      const warning =
        err instanceof TenantNotEmptyError
          ? `Reunion was created but demo seed refused: ${err.message}`
          : err instanceof Error
            ? `Reunion was created but demo seed failed: ${err.message}`
            : "Reunion was created but demo seed failed.";
      console.error("[create-reunion] demo seed post-create failed", err);
      return NextResponse.json(
        {
          ok: true,
          reunion: { id: createdId, slug: createdSlug },
          warning,
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json(
    { ok: true, reunion: { id: createdId, slug: createdSlug } },
    { status: 201 }
  );
}
