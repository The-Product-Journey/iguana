import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { profileId, action } = await req.json();

  if (!profileId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "togglePublished") {
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .get();

    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(profiles)
      .set({
        isPublished: !profile.isPublished,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, profileId));
  }

  return NextResponse.json({ success: true });
}
