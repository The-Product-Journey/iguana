import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reunionId,
      firstName,
      lastName,
      email,
      phone,
      guestCount,
      dietaryNotes,
      message,
    } = body;

    if (!reunionId || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Please fill in all required fields" },
        { status: 400 }
      );
    }

    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.id, reunionId))
      .get();

    if (!reunion || !reunion.isActive) {
      return NextResponse.json(
        { error: "Reunion not found or inactive" },
        { status: 404 }
      );
    }

    await db.insert(rsvps).values({
      reunionId,
      firstName,
      lastName,
      email,
      phone: phone || null,
      guestCount: guestCount || 1,
      dietaryNotes: dietaryNotes || null,
      message: message || null,
      paymentStatus: "pending",
      amountPaidCents: 0,
      donationCents: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pre-register error:", error);
    return NextResponse.json(
      { error: "Failed to pre-register" },
      { status: 500 }
    );
  }
}
