import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memorials } from "@/lib/db/schema";
import { uploadImage } from "@/lib/upload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const reunionId = formData.get("reunionId") as string;
    const deceasedFirstName = formData.get("deceasedFirstName") as string;
    const deceasedLastName = formData.get("deceasedLastName") as string;
    const yearOfBirth = (formData.get("yearOfBirth") as string) || null;
    const yearOfDeath = (formData.get("yearOfDeath") as string) || null;
    const tributeText = formData.get("tributeText") as string;
    const submitterName = formData.get("submitterName") as string;
    const submitterEmail = formData.get("submitterEmail") as string;
    const submitterPhone = (formData.get("submitterPhone") as string) || null;
    const submitterRelationship =
      (formData.get("submitterRelationship") as string) || null;
    const photoFile = formData.get("photo") as File | null;

    if (
      !reunionId ||
      !deceasedFirstName ||
      !deceasedLastName ||
      !tributeText ||
      !submitterName ||
      !submitterEmail
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let deceasedPhotoUrl: string | null = null;
    if (photoFile && photoFile.size > 0) {
      deceasedPhotoUrl = await uploadImage(photoFile, "memorials");
    }

    const [memorial] = await db
      .insert(memorials)
      .values({
        reunionId,
        deceasedFirstName,
        deceasedLastName,
        deceasedPhotoUrl,
        yearOfBirth,
        yearOfDeath,
        tributeText,
        submitterName,
        submitterEmail,
        submitterPhone,
        submitterRelationship,
        status: "submitted",
      })
      .returning();

    return NextResponse.json({
      success: true,
      reviewToken: memorial.reviewToken,
    });
  } catch (error) {
    console.error("Memorial submission error:", error);
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
