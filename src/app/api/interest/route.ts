import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interestSignups, eventInterests, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_RESPONSES = new Set(["yes", "maybe", "no"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reunionId, email, name, maidenName, eventResponses } = body;

    if (!reunionId || !email) {
      return NextResponse.json(
        { error: "Reunion ID and email are required" },
        { status: 400 }
      );
    }

    // eventResponses is { [eventId]: "yes" | "maybe" | "no" }
    const responsesMap: Record<string, "yes" | "maybe" | "no"> = {};
    if (eventResponses && typeof eventResponses === "object") {
      for (const [eventId, response] of Object.entries(eventResponses)) {
        if (
          typeof response === "string" &&
          VALID_RESPONSES.has(response)
        ) {
          responsesMap[eventId] = response as "yes" | "maybe" | "no";
        }
      }
    }

    // Upsert: check for existing signup with same reunion + email
    const existing = await db
      .select()
      .from(interestSignups)
      .where(
        and(
          eq(interestSignups.reunionId, reunionId),
          eq(interestSignups.email, email)
        )
      )
      .get();

    let signupId: string;

    if (existing) {
      const updates: { name?: string | null; maidenName?: string | null } = {};
      if (name !== undefined) updates.name = name || null;
      if (maidenName !== undefined) updates.maidenName = maidenName || null;
      if (Object.keys(updates).length > 0) {
        await db
          .update(interestSignups)
          .set(updates)
          .where(eq(interestSignups.id, existing.id));
      }
      signupId = existing.id;

      // Clear old event interests for re-insert
      await db
        .delete(eventInterests)
        .where(eq(eventInterests.interestSignupId, signupId));
    } else {
      const [signup] = await db
        .insert(interestSignups)
        .values({
          reunionId,
          email,
          name: name || null,
          maidenName: maidenName || null,
        })
        .returning();
      signupId = signup.id;
    }

    // Insert event interests with response (validate eventIds belong to this reunion)
    const eventIds = Object.keys(responsesMap);
    if (eventIds.length > 0) {
      const reunionEvents = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.reunionId, reunionId));

      const validEventIds = new Set(reunionEvents.map((e) => e.id));
      const rows = eventIds
        .filter((id) => validEventIds.has(id))
        .map((eventId) => ({
          interestSignupId: signupId,
          eventId,
          response: responsesMap[eventId],
        }));

      if (rows.length > 0) {
        await db.insert(eventInterests).values(rows);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Interest signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
