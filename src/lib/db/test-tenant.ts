// Shared helpers for the test tenant (`phhs-1996-test`).
// Used by both `seed-test.ts` (wipe + seed sample data) and `wipe-test.ts`
// (wipe + leave a bare empty reunion record for onboarding tests).
//
// The test tenant's "shell" (name, description, event metadata) mirrors the
// production reunion (`phhs-1996`) so the public site renders identically.
// Only siteMode, registrationOpen, Stripe Connect state, and the sample
// data (RSVPs/sponsors/profiles/etc.) are test-specific.
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
const PROD_REUNION_SLUG = "phhs-1996";

type Db = ReturnType<typeof drizzle>;

type Shell = {
  name: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  eventAddress: string | null;
  registrationFeeCents: number;
  maxAttendees: number | null;
};

/**
 * Read the production reunion's shell (name, description, event metadata).
 * Falls back to reasonable defaults if the prod reunion doesn't exist yet
 * (e.g., a fresh dev environment that's never been seeded).
 */
async function loadProdShell(db: Db): Promise<Shell> {
  const prod = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, PROD_REUNION_SLUG))
    .get();

  if (prod) {
    return {
      name: prod.name,
      description: prod.description,
      eventDate: prod.eventDate,
      eventTime: prod.eventTime,
      eventLocation: prod.eventLocation,
      eventAddress: prod.eventAddress,
      registrationFeeCents: prod.registrationFeeCents,
      maxAttendees: prod.maxAttendees,
    };
  }

  return {
    name: "Park Hill High School — Class of 1996",
    description: null,
    eventDate: "2026-08-28",
    eventTime: null,
    eventLocation: null,
    eventAddress: null,
    registrationFeeCents: 9876,
    maxAttendees: 300,
  };
}

export type StripeLinkage = {
  stripeConnectedAccountId: string;
  stripeConnectOnboardingComplete: boolean;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
};

/**
 * Wipe everything for the test tenant — all dependent rows and the reunion
 * record itself. Safe to call when the test reunion does not exist.
 *
 * `options.preserveStripe` (default false): when true, capture the existing
 * reunion's Stripe Connect linkage and return it so the caller can re-apply
 * it on a freshly-created reunion. Used by `seed-test` so a data refresh
 * doesn't force the admin to re-do Stripe onboarding.
 */
export async function wipeTestTenant(
  db: Db,
  options: { preserveStripe?: boolean } = {}
): Promise<StripeLinkage | null> {
  const existing = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, TEST_REUNION_SLUG))
    .get();

  if (!existing) return null;

  const reunionId = existing.id;
  const captured: StripeLinkage | null =
    options.preserveStripe && existing.stripeConnectedAccountId
      ? {
          stripeConnectedAccountId: existing.stripeConnectedAccountId,
          stripeConnectOnboardingComplete:
            !!existing.stripeConnectOnboardingComplete,
          stripeConnectChargesEnabled:
            !!existing.stripeConnectChargesEnabled,
          stripeConnectPayoutsEnabled:
            !!existing.stripeConnectPayoutsEnabled,
        }
      : null;

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

  return captured;
}

/**
 * Create a bare empty test reunion — what an admin would see right after
 * creating a fresh tenant. No events, siteMode=tease. The shell mirrors
 * prod so the public site renders identically.
 *
 * Pass `stripeLinkage` to pre-attach an existing Stripe connected account
 * (used by `seed-test` to preserve linkage across data wipes so admins
 * don't have to redo Stripe onboarding).
 */
export async function createBareTestReunion(
  db: Db,
  stripeLinkage?: StripeLinkage | null
) {
  const shell = await loadProdShell(db);
  const [reunion] = await db
    .insert(reunions)
    .values({
      slug: TEST_REUNION_SLUG,
      ...shell,
      registrationOpen: false,
      siteMode: "tease",
      stripeConnectedAccountId: stripeLinkage?.stripeConnectedAccountId ?? null,
      stripeConnectOnboardingComplete:
        stripeLinkage?.stripeConnectOnboardingComplete ?? false,
      stripeConnectChargesEnabled:
        stripeLinkage?.stripeConnectChargesEnabled ?? false,
      stripeConnectPayoutsEnabled:
        stripeLinkage?.stripeConnectPayoutsEnabled ?? false,
    })
    .returning();
  return reunion;
}

export { loadProdShell };
