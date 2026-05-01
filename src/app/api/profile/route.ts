import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rsvps, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uploadImage } from "@/lib/upload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const rsvpId = formData.get("rsvpId") as string;
    const editToken = formData.get("editToken") as string;

    if (!rsvpId || !editToken) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate edit token
    const rsvp = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.id, rsvpId))
      .get();

    if (!rsvp || rsvp.editToken !== editToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Handle photo upload
    const photoFile = formData.get("photo") as File | null;
    let photoUrl: string | undefined;
    if (photoFile && photoFile.size > 0) {
      photoUrl = await uploadImage(photoFile, "profiles");
    }

    // Form field name was renamed in Phase 3 (favoritePHMemory →
    // favoriteSchoolMemory). Read the new field with a fallback to the
    // old field name so any in-flight form (page already loaded before
    // this deploy) still saves correctly.
    const favoriteSchoolMemory =
      (formData.get("favoriteSchoolMemory") as string) ||
      (formData.get("favoritePHMemory") as string) ||
      null;
    const profileData = {
      currentCity: (formData.get("currentCity") as string) || null,
      occupation: (formData.get("occupation") as string) || null,
      family: (formData.get("family") as string) || null,
      favoriteSchoolMemory,
      beenUpTo: (formData.get("beenUpTo") as string) || null,
      funFact: (formData.get("funFact") as string) || null,
      ...(photoUrl ? { photoUrl } : {}),
      updatedAt: new Date().toISOString(),
    };

    // Check if profile exists
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.rsvpId, rsvpId))
      .get();

    if (existing) {
      await db
        .update(profiles)
        .set(profileData)
        .where(eq(profiles.id, existing.id));
    } else {
      await db.insert(profiles).values({
        rsvpId,
        ...profileData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile save error:", error);
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
