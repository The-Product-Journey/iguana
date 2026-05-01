/**
 * Live slug-availability check for the Create Tenant form.
 *
 * Returns `{ ok, reason? }` where ok=false either because of format /
 * reserved-word rules (`validateSlug`) or because the slug is taken.
 *
 * Auth: super-admin only — same gate as the create endpoint, since
 * mass-querying slug availability would otherwise leak which slugs are
 * in use to anyone signed in. Debounced on the client (Phase 4.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { validateSlug } from "@/lib/tenant-slug";

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const slug = req.nextUrl.searchParams.get("slug")?.trim() ?? "";
  if (!slug) {
    return NextResponse.json(
      { ok: false, reason: "Slug is required." },
      { status: 400 }
    );
  }

  const formatCheck = validateSlug(slug);
  if (!formatCheck.ok) {
    return NextResponse.json({ ok: false, reason: formatCheck.reason });
  }

  const existing = await db
    .select({ id: reunions.id })
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (existing) {
    return NextResponse.json({
      ok: false,
      reason: "That slug is already in use.",
    });
  }

  return NextResponse.json({ ok: true });
}
