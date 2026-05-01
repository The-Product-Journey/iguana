import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunionAdmins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";

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

  try {
    const [row] = await db
      .insert(reunionAdmins)
      .values({
        reunionId,
        email,
        invitedByEmail: guard.email,
      })
      .returning();
    return NextResponse.json({ ok: true, admin: row });
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
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(reunionAdmins).where(eq(reunionAdmins.id, id));
  return NextResponse.json({ ok: true });
}
