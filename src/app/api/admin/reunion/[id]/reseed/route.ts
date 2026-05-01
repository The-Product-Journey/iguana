/**
 * Re-seed a reunion with the generic demo dataset.
 *
 * Super-admin only. The empty-tenant guard inside `seedDemoTenant` walks
 * all 9 tenant-scoped tables and refuses if any row exists for the
 * reunion — so this is safe to expose as long as we let
 * `TenantNotEmptyError` surface to the operator as a 409 with the
 * non-empty table list. That's strictly more useful than blanket-blocking
 * "tenants with any data": the operator sees exactly what's in the way.
 *
 * Why super-only and not reunion-admin: a reunion admin re-seeding their
 * own tenant could nuke real RSVPs / sponsors / memorials if the empty
 * guard ever regressed. Belt-and-suspenders — keep the destructive path
 * behind super-admin until we have a stronger UX safety net.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { seedDemoTenant, TenantNotEmptyError } from "@/lib/db/seed-demo";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const result = await seedDemoTenant(db, id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof TenantNotEmptyError) {
      return NextResponse.json(
        {
          error: err.message,
          nonEmptyTables: err.nonEmptyTables,
        },
        { status: 409 }
      );
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json(
        { error: "Reunion not found." },
        { status: 404 }
      );
    }
    console.error("[reseed] failed", err);
    return NextResponse.json(
      { error: "Failed to reseed reunion." },
      { status: 500 }
    );
  }
}
