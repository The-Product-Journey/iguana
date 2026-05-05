import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunionAdmins, reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { sendAdminInvite, revokePendingInvite } from "@/lib/clerk-invites";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const rows = await db.select().from(reunionAdmins).all();
  return NextResponse.json({ admins: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { reunionId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reunionId = body.reunionId?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!reunionId || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "reunionId and a valid email are required" },
      { status: 400 }
    );
  }

  let row;
  try {
    [row] = await db
      .insert(reunionAdmins)
      .values({
        reunionId,
        email,
        invitedByEmail: guard.email,
      })
      .returning();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.includes("idx_reunion_admins")) {
      return NextResponse.json(
        { error: "This email is already an admin for that reunion." },
        { status: 409 }
      );
    }
    if (msg.includes("FOREIGN KEY")) {
      return NextResponse.json(
        { error: "Reunion not found." },
        { status: 404 }
      );
    }
    console.error("[super/admins] insert failed", err);
    return NextResponse.json(
      { error: "Failed to add admin." },
      { status: 500 }
    );
  }

  // DB row created. Send a Clerk invitation as a separate step — best
  // effort. If Clerk fails (rate limit, env not set, etc.), the admin
  // row still exists and we surface the failure in the response so the
  // UI can offer a Resend action. The fallback "passive" path also
  // still works: the user can sign up manually and getCurrentAdminContext
  // will backfill on first sign-in.
  const reunion = await db
    .select({ slug: reunions.slug })
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();
  const redirectPath = reunion ? `/admin/${reunion.slug}` : "/admin";

  let inviteError: string | null = null;
  try {
    await sendAdminInvite(email, redirectPath);
  } catch (err) {
    inviteError =
      err instanceof Error ? err.message : "Unknown invite error";
    console.error("[super/admins] invite send failed", err);
  }

  return NextResponse.json({ ok: true, admin: row, inviteError });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Look up the row first so we have the email to revoke any pending
  // Clerk invitation. If we don't revoke, an outstanding invite would
  // still let someone sign up after we removed them from the allowlist
  // (they'd still bounce off the auth check, but it's noisier than
  // necessary).
  const row = await db
    .select({ email: reunionAdmins.email })
    .from(reunionAdmins)
    .where(eq(reunionAdmins.id, id))
    .get();

  await db.delete(reunionAdmins).where(eq(reunionAdmins.id, id));

  if (row?.email) {
    try {
      await revokePendingInvite(row.email);
    } catch (err) {
      // Don't fail the delete — the DB row is gone, which is the source
      // of truth for access. Log and move on.
      console.error("[super/admins] invite revoke failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
