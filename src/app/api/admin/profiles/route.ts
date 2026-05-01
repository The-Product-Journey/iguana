import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profiles, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { profileId, action } = await req.json();

  if (!profileId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // profiles has no reunionId column — derive it via the rsvp link.
  // (profiles.rsvpId → rsvps.id → rsvps.reunionId)
  const row = await db
    .select({
      profile: profiles,
      reunionId: rsvps.reunionId,
    })
    .from(profiles)
    .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
    .where(eq(profiles.id, profileId))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guard = await requireReunionAdmin(row.reunionId);
  if (guard instanceof NextResponse) return guard;

  if (action === "togglePublished") {
    await db
      .update(profiles)
      .set({
        isPublished: !row.profile.isPublished,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, profileId));
  }

  return NextResponse.json({ success: true });
}
