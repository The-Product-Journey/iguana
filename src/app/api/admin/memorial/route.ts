import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memorials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { memorialId, action, adminDraft, status } = await req.json();

  if (!memorialId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Resolve reunionId from the target memorial. memorials.reunionId is a
  // direct column on the table — no join needed.
  const memorial = await db
    .select({ reunionId: memorials.reunionId })
    .from(memorials)
    .where(eq(memorials.id, memorialId))
    .get();

  if (!memorial) {
    return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
  }

  const guard = await requireReunionAdmin(memorial.reunionId);
  if (guard instanceof NextResponse) return guard;

  if (action === "updateDraft") {
    await db
      .update(memorials)
      .set({
        adminDraft: typeof adminDraft === "string" ? adminDraft : JSON.stringify(adminDraft),
        status: status || "draft",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memorials.id, memorialId));
  } else if (action === "sendForReview") {
    await db
      .update(memorials)
      .set({
        status: "pending_review",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memorials.id, memorialId));
  } else if (action === "publish") {
    await db
      .update(memorials)
      .set({
        status: "published",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memorials.id, memorialId));
  }

  return NextResponse.json({ success: true });
}
