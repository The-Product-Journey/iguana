// Shared helpers for the test tenant (`phhs-1996-test`).
// Used by both `seed-test.ts` (wipe + seed sample data) and `wipe-test.ts`
// (wipe + leave a bare empty reunion record for onboarding tests).
import { drizzle } from "drizzle-orm/libsql";
import { eq, inArray } from "drizzle-orm";
import {
  reunions,
  events,
  rsvps,
  registrationEvents,
  profiles,
  sponsors,
  memorials,
  interestSignups,
  eventInterests,
  contactMessages,
} from "./schema";

export const TEST_REUNION_SLUG = "phhs-1996-test";

type Db = ReturnType<typeof drizzle>;

/**
 * Wipe everything for the test tenant — all dependent rows and the reunion
 * record itself. Safe to call when the test reunion does not exist.
 */
export async function wipeTestTenant(db: Db): Promise<void> {
  const existing = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, TEST_REUNION_SLUG))
    .get();

  if (!existing) return;

  const reunionId = existing.id;

  const existingRsvps = await db
    .select({ id: rsvps.id })
    .from(rsvps)
    .where(eq(rsvps.reunionId, reunionId));
  const rsvpIds = existingRsvps.map((r) => r.id);

  const existingInterest = await db
    .select({ id: interestSignups.id })
    .from(interestSignups)
    .where(eq(interestSignups.reunionId, reunionId));
  const interestIds = existingInterest.map((i) => i.id);

  // Delete leaves first, then trunks
  if (rsvpIds.length > 0) {
    await db
      .delete(registrationEvents)
      .where(inArray(registrationEvents.rsvpId, rsvpIds));
    await db.delete(profiles).where(inArray(profiles.rsvpId, rsvpIds));
  }
  if (interestIds.length > 0) {
    await db
      .delete(eventInterests)
      .where(inArray(eventInterests.interestSignupId, interestIds));
  }
  await db.delete(rsvps).where(eq(rsvps.reunionId, reunionId));
  await db
    .delete(interestSignups)
    .where(eq(interestSignups.reunionId, reunionId));
  await db.delete(sponsors).where(eq(sponsors.reunionId, reunionId));
  await db.delete(memorials).where(eq(memorials.reunionId, reunionId));
  await db
    .delete(contactMessages)
    .where(eq(contactMessages.reunionId, reunionId));
  await db.delete(events).where(eq(events.reunionId, reunionId));
  await db.delete(reunions).where(eq(reunions.id, reunionId));
}

/**
 * Create a bare empty test reunion — what an admin would see right after
 * creating a fresh tenant. No events, no Stripe Connect, siteMode=tease.
 * The admin can then walk through onboarding (toggle modes, add events,
 * connect Stripe, etc.) to test that flow end-to-end.
 */
export async function createBareTestReunion(db: Db) {
  const [reunion] = await db
    .insert(reunions)
    .values({
      slug: TEST_REUNION_SLUG,
      name: "Park Hill High School — Class of 1996 (TEST)",
      description:
        "This is a TEST environment. Use it to walk through the onboarding flow or to play with sample data.",
      eventDate: "2026-08-28",
      eventTime: "August 28–29, 2026",
      eventLocation: null,
      eventAddress: null,
      registrationFeeCents: 9876,
      registrationOpen: false,
      siteMode: "tease",
      maxAttendees: 300,
    })
    .returning();
  return reunion;
}
