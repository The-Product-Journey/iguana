import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superAdmins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { sendAdminInvite, revokePendingInvite } from "@/lib/clerk-invites";

/**
 * Re-issue a Clerk invitation for an existing super-admin row. Same
 * pattern as the reunion-admin resend endpoint — revoke pending first,
 * then send a fresh invite.
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
    .select({ email: superAdmins.email })
    .from(superAdmins)
    .where(eq(superAdmins.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Super admin not found" }, { status: 404 });
  }

  try {
    await revokePendingInvite(row.email);
  } catch (err) {
    console.error("[super/super-admins/resend] revoke failed", err);
  }

  try {
    await sendAdminInvite(row.email, "/admin/super");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
