import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superAdmins } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { sendAdminInvite, revokePendingInvite } from "@/lib/clerk-invites";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const rows = await db.select().from(superAdmins).all();
  return NextResponse.json({ admins: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  // Pre-check unique constraint so we never rely on parsing DB error
  // strings (libsql/Turso error formatting varies). The catch below
  // is kept as a race fallback.
  const existing = await db
    .select({ id: superAdmins.id })
    .from(superAdmins)
    .where(eq(superAdmins.email, email))
    .get();
  if (existing) {
    return NextResponse.json(
      {
        error: `${email} is already a super admin. Find their row below to resend or revoke their invite.`,
      },
      { status: 409 }
    );
  }

  let row;
  try {
    [row] = await db
      .insert(superAdmins)
      .values({ email, invitedByEmail: guard.email })
      .returning();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Race fallback: another super admin added the same email between
    // our pre-check and our insert.
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json(
        { error: `${email} is already a super admin.` },
        { status: 409 }
      );
    }
    console.error("[super/super-admins] insert failed", err);
    return NextResponse.json(
      { error: "Couldn't add super admin. Please try again." },
      { status: 500 }
    );
  }

  // Best-effort Clerk invite. See same-shaped comment in
  // /api/admin/super/admins for rationale.
  let inviteError: string | null = null;
  let inviteStatus: "sent" | "user-exists" | null = null;
  try {
    const result = await sendAdminInvite(email, "/admin/super");
    inviteStatus = result.kind;
    if (result.kind === "user-exists") {
      await db
        .update(superAdmins)
        .set({ clerkUserId: result.clerkUserId })
        .where(eq(superAdmins.id, row.id));
    }
  } catch (err) {
    inviteError =
      err instanceof Error ? err.message : "Unknown invite error";
    console.error("[super/super-admins] invite send failed", err);
  }

  return NextResponse.json({
    ok: true,
    admin: row,
    inviteStatus,
    inviteError,
  });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Look up the row first so we can enforce two guardrails server-side:
  //   1. You cannot remove yourself (must be done by another super admin).
  //   2. You cannot remove the last super admin (would lock everyone out).
  const target = await db
    .select({ id: superAdmins.id, email: superAdmins.email })
    .from(superAdmins)
    .where(eq(superAdmins.id, id))
    .get();

  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (target.email === guard.email) {
    return NextResponse.json(
      {
        error:
          "You can't remove yourself as a super admin. Ask another super admin to do it.",
      },
      { status: 400 }
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(superAdmins)
    .all();

  if (count <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last super admin." },
      { status: 400 }
    );
  }

  await db.delete(superAdmins).where(eq(superAdmins.id, id));

  // Revoke any pending Clerk invitation for this email (if one exists)
  // so a stale invite link can't onboard a removed super admin.
  try {
    await revokePendingInvite(target.email);
  } catch (err) {
    console.error("[super/super-admins] invite revoke failed", err);
  }

  return NextResponse.json({ ok: true });
}
