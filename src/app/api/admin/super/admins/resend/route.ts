import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunionAdmins, reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { sendAdminInvite, revokePendingInvite } from "@/lib/clerk-invites";

/**
 * Re-issue a Clerk invitation for an existing reunion-admin row.
 * Revokes any prior pending invite first so we never have two live
 * invites for the same email pointing at potentially different
 * reunions.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const row = await db
    .select({
      email: reunionAdmins.email,
      reunionId: reunionAdmins.reunionId,
    })
    .from(reunionAdmins)
    .where(eq(reunionAdmins.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const reunion = await db
    .select({ slug: reunions.slug })
    .from(reunions)
    .where(eq(reunions.id, row.reunionId))
    .get();
  const redirectPath = reunion ? `/admin/${reunion.slug}` : "/admin";

  try {
    await revokePendingInvite(row.email);
  } catch (err) {
    // If revoke fails (e.g. already accepted, network glitch), still
    // try to send a fresh one — Clerk will reject as a duplicate if
    // there's still a live invite, and we'll surface that.
    console.error("[super/admins/resend] revoke failed", err);
  }

  try {
    await sendAdminInvite(row.email, redirectPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
