import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rsvps, registrationEvents, events, reunions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getPostHogClient } from "@/lib/posthog-server";

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
      eventIds,
    } = body;

    if (!reunionId || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify site mode is open
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.id, reunionId))
      .get();

    if (!reunion || reunion.siteMode !== "open") {
      return NextResponse.json(
        { error: "Registration is not open yet" },
        { status: 403 }
      );
    }

    // Validate eventIds belong to this reunion
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      const reunionEvents = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(eq(events.reunionId, reunionId), inArray(events.id, eventIds))
        );

      if (reunionEvents.length !== eventIds.length) {
        return NextResponse.json(
          { error: "One or more invalid event selections" },
          { status: 400 }
        );
      }
    }

    const editToken = crypto.randomUUID();

    // Create RSVP
    const [rsvp] = await db
      .insert(rsvps)
      .values({
        reunionId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        guestCount: guestCount || 1,
        dietaryNotes: dietaryNotes || null,
        message: message || null,
        editToken,
        paymentMethod: "door",
        paymentStatus: "pending",
      })
      .returning();

    // Insert event selections
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      await db.insert(registrationEvents).values(
        eventIds.map((eventId: string) => ({
          rsvpId: rsvp.id,
          eventId,
        }))
      );
    }

    const posthog = getPostHogClient();
    posthog.identify({ distinctId: email, properties: { name: `${firstName} ${lastName}`, email } });
    posthog.capture({
      distinctId: email,
      event: "rsvp_registered",
      properties: {
        reunion_id: reunionId,
        rsvp_id: rsvp.id,
        payment_method: "door",
        guest_count: guestCount || 1,
        event_count: Array.isArray(eventIds) ? eventIds.length : 0,
      },
    });

    return NextResponse.json({ success: true, editToken });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
