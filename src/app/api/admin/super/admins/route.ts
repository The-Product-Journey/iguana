import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunionAdmins, reunions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
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

  // Pre-check the foreign key + unique constraints up front so we can
  // return precise, actionable errors instead of relying on parsing DB
  // exception strings (libsql/Turso error formatting varies). The DB
  // catch below is kept as a fallback for race conditions.
  const reunionExists = await db
    .select({ id: reunions.id, name: reunions.name })
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();
  if (!reunionExists) {
    return NextResponse.json({ error: "Reunion not found." }, { status: 404 });
  }

  const existing = await db
    .select({ id: reunionAdmins.id })
    .from(reunionAdmins)
    .where(
      and(
        eq(reunionAdmins.reunionId, reunionId),
        eq(reunionAdmins.email, email)
      )
    )
    .get();
  if (existing) {
    return NextResponse.json(
      {
        error: `${email} is already an admin for ${reunionExists.name}. Scroll to their row below to resend or revoke their invite.`,
      },
      { status: 409 }
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
    // Race fallback: another super admin added the same email between
    // our pre-check and our insert.
    if (msg.includes("UNIQUE") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json(
        {
          error: `${email} is already an admin for ${reunionExists.name}.`,
        },
        { status: 409 }
      );
    }
    console.error("[super/admins] insert failed", err);
    return NextResponse.json(
      { error: "Couldn't add admin. Please try again." },
      { status: 500 }
    );
  }

  // DB row created. Send a Clerk invitation as a separate step — best
  // effort. If Clerk fails (rate limit, env not set, etc.), the admin
  // row still exists and we surface the failure in the response so the
  // UI can offer a Resend action. The fallback "passive" path also
  // still works: the user can sign up manually and getCurrentAdminContext
  // will backfill on first sign-in.
  const reunionForRedirect = await db
    .select({ slug: reunions.slug })
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();
  const redirectPath = reunionForRedirect
    ? `/admin/${reunionForRedirect.slug}`
    : "/admin";

  let inviteError: string | null = null;
  let inviteStatus: "sent" | "user-exists" | null = null;
  try {
    const result = await sendAdminInvite(email, redirectPath);
    inviteStatus = result.kind;
    if (result.kind === "user-exists") {
      // Existing Clerk user — skip the invitation and immediately
      // backfill clerkUserId so this row reads as Active without
      // waiting for the user's next sign-in.
      await db
        .update(reunionAdmins)
        .set({ clerkUserId: result.clerkUserId })
        .where(eq(reunionAdmins.id, row.id));
    }
  } catch (err) {
    inviteError =
      err instanceof Error ? err.message : "Unknown invite error";
    console.error("[super/admins] invite send failed", err);
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
