import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { memorials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memorialId, action, adminDraft, status } = await req.json();

  if (!memorialId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

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
