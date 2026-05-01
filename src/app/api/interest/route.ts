import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { interestSignups, eventInterests, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reunionId, email, name, maidenName, eventIds } = body;

    if (!reunionId || !email) {
      return NextResponse.json(
        { error: "Reunion ID and email are required" },
        { status: 400 }
      );
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
      // Update name fields if any provided
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

    // Insert event interests (validate eventIds belong to this reunion)
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      const reunionEvents = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.reunionId, reunionId));

      const validEventIds = new Set(reunionEvents.map((e) => e.id));
      const filteredIds = eventIds.filter((id: string) =>
        validEventIds.has(id)
      );

      if (filteredIds.length > 0) {
        await db.insert(eventInterests).values(
          filteredIds.map((eventId: string) => ({
            interestSignupId: signupId,
            eventId,
          }))
        );
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
