/**
 * `seedDemoTenant` — populates a reunion with the generic demo dataset.
 *
 * Used in three places:
 *   1. CreateTenant flow (`src/app/api/admin/super/reunions/route.ts`)
 *      when the super admin checks "with demo data" — runs immediately
 *      after the reunion row insert.
 *   2. Settings → "Re-seed with demo data" button (super-admin only) for
 *      empty tenants. Wired through `/api/admin/reunion/[id]/reseed`
 *      (Phase 5.3a).
 *   3. The `db:seed-demo` CLI (`seed-demo-cli.ts`) for shell-driven
 *      backfills against any reunion slug.
 *
 * Safety contract:
 *   - The reunion is REQUIRED to be empty across all tenant-scoped tables
 *     (events, rsvps, registrationEvents, profiles, sponsors, memorials,
 *     interestSignups, eventInterests, contactMessages). If any of those
 *     have rows for the reunion, this function throws TenantNotEmptyError
 *     so callers can return a 409 to the operator.
 *   - All inserts run in a single transaction; partial failures roll back.
 *
 * Idempotency / rerun:
 *   - Calling this against a tenant that already has demo data inserted
 *     would be unsafe (duplicate keys, FK violations against the
 *     unique-(reunionId,email) interest-signup index, etc.). The empty
 *     guard above prevents that. To re-seed, the operator must wipe the
 *     tenant first via the existing `wipe-test` flow generalized to any
 *     slug — that's a separate utility, deliberately out of scope here.
 *
 * Email collisions across multiple demo tenants:
 *   - The unique constraint on `interest_signups(reunionId, email)` is
 *     scoped per-reunion, so two demo tenants can both have
 *     "demo.interest.1@..." without conflict.
 *   - `rsvps` has no unique-email constraint at all; collisions are
 *     impossible there.
 *   - We still namespace the email *local part* by a short reunion-id
 *     suffix so the addresses look distinct in the admin UI when an
 *     operator is staring at multiple demo tenants side by side.
 *
 * Demo tenant config backfill:
 *   - The seeded `saturday-service` event references a community-service
 *     project. To keep the homepage CS block + dedicated /community-service
 *     page consistent with that event, when the reunion's
 *     `communityServiceProjectName` is null we backfill the demo CS config
 *     onto the reunion row inside the same transaction. Existing
 *     CS config is left alone (operator may have set it manually).
 */
import { eq, sql } from "drizzle-orm";
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
import {
  DEMO_CANONICAL_EVENTS,
  DEMO_SAMPLE_PEOPLE,
  DEMO_SPONSORS,
  DEMO_MEMORIAL,
  DEMO_INTEREST_SIGNUPS,
  DEMO_COMMUNITY_SERVICE_CONFIG,
} from "./canonical-events-demo";
import { getSponsorTier } from "@/lib/constants";
import type { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

export class TenantNotEmptyError extends Error {
  readonly nonEmptyTables: { table: string; count: number }[];
  constructor(nonEmptyTables: { table: string; count: number }[]) {
    super(
      `Tenant is not empty — refusing to seed demo data. Non-empty tables: ${nonEmptyTables
        .map((t) => `${t.table}(${t.count})`)
        .join(", ")}`
    );
    this.name = "TenantNotEmptyError";
    this.nonEmptyTables = nonEmptyTables;
  }
}

export type SeedDemoResult = {
  events: number;
  rsvps: number;
  profiles: number;
  sponsors: number;
  memorials: number;
  interestSignups: number;
  registrationEvents: number;
  eventInterests: number;
  communityServiceBackfilled: boolean;
};

/**
 * Walk every tenant-scoped table and confirm zero rows for this reunion.
 * Joins through `rsvps` for the two row types that don't carry reunionId
 * directly (registrationEvents, profiles).
 */
async function findNonEmptyTables(
  db: Db,
  reunionId: string
): Promise<{ table: string; count: number }[]> {
  const checks: { name: string; count: number }[] = [];

  const [eventsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(eq(events.reunionId, reunionId));
  checks.push({ name: "events", count: Number(eventsRow?.count ?? 0) });

  const [rsvpRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rsvps)
    .where(eq(rsvps.reunionId, reunionId));
  checks.push({ name: "rsvps", count: Number(rsvpRow?.count ?? 0) });

  // registrationEvents → join through rsvps.reunionId
  const [regEventsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(registrationEvents)
    .innerJoin(rsvps, eq(registrationEvents.rsvpId, rsvps.id))
    .where(eq(rsvps.reunionId, reunionId));
  checks.push({
    name: "registration_events",
    count: Number(regEventsRow?.count ?? 0),
  });

  // profiles → join through rsvps.reunionId
  const [profilesRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(profiles)
    .innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
    .where(eq(rsvps.reunionId, reunionId));
  checks.push({
    name: "profiles",
    count: Number(profilesRow?.count ?? 0),
  });

  const [sponsorsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sponsors)
    .where(eq(sponsors.reunionId, reunionId));
  checks.push({
    name: "sponsors",
    count: Number(sponsorsRow?.count ?? 0),
  });

  const [memorialsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memorials)
    .where(eq(memorials.reunionId, reunionId));
  checks.push({
    name: "memorials",
    count: Number(memorialsRow?.count ?? 0),
  });

  const [interestRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(interestSignups)
    .where(eq(interestSignups.reunionId, reunionId));
  checks.push({
    name: "interest_signups",
    count: Number(interestRow?.count ?? 0),
  });

  // eventInterests → join through interestSignups.reunionId
  const [eventInterestRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventInterests)
    .innerJoin(
      interestSignups,
      eq(eventInterests.interestSignupId, interestSignups.id)
    )
    .where(eq(interestSignups.reunionId, reunionId));
  checks.push({
    name: "event_interests",
    count: Number(eventInterestRow?.count ?? 0),
  });

  const [contactRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contactMessages)
    .where(eq(contactMessages.reunionId, reunionId));
  checks.push({
    name: "contact_messages",
    count: Number(contactRow?.count ?? 0),
  });

  return checks
    .filter((c) => c.count > 0)
    .map((c) => ({ table: c.name, count: c.count }));
}

export async function seedDemoTenant(
  db: Db,
  reunionId: string
): Promise<SeedDemoResult> {
  // Guard: read the reunion row up front (so we can backfill CS config) and
  // verify emptiness across every tenant-scoped table before mutating.
  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();
  if (!reunion) {
    throw new Error(`Reunion ${reunionId} not found`);
  }

  const nonEmpty = await findNonEmptyTables(db, reunionId);
  if (nonEmpty.length > 0) {
    throw new TenantNotEmptyError(nonEmpty);
  }

  // Short suffix for the email local-part namespacing — see file-level
  // comment. 8 hex chars from the reunion id is enough to disambiguate
  // human-staring-at-list cases without making the email unreadable.
  const idTag = reunionId.replace(/-/g, "").slice(0, 8);
  const tagEmail = (local: string) => `${local}.${idTag}@example.com`;

  // Reunion's eventDate is the source of truth — see PLAN. Demo events
  // inherit it; we don't take an opts.eventDate.
  const reunionDate = reunion.eventDate;

  // Compute an early-bird deadline ~60 days before the reunion. If the
  // reunion is closer than that (or in the past — unusual but possible
  // for a freshly created retrospective demo) we just drop the deadline
  // and let the standard price stand.
  function daysBefore(dateStr: string, days: number): string | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - days);
    const today = new Date();
    if (d.getTime() <= today.getTime()) return null;
    return d.toISOString().slice(0, 10);
  }
  const earlyDeadline = daysBefore(reunionDate, 60);

  const result: SeedDemoResult = {
    events: 0,
    rsvps: 0,
    profiles: 0,
    sponsors: 0,
    memorials: 0,
    interestSignups: 0,
    registrationEvents: 0,
    eventInterests: 0,
    communityServiceBackfilled: false,
  };

  await db.transaction(async (tx) => {
    // ----- Events -----
    const eventInserts = DEMO_CANONICAL_EVENTS.map((e) => ({
      reunionId,
      slug: e.slug,
      name: e.name,
      description: e.description,
      eventDate: reunionDate, // same date for all four; UI orders by sortOrder
      eventTime: e.eventTime,
      eventLocation: e.eventLocation,
      eventAddress: e.eventAddress,
      tentativeLabel: e.tentativeLabel,
      type: e.type,
      priceCents: e.priceCents ?? null,
      earlyPriceCents: e.earlyPriceCents ?? null,
      earlyPriceDeadline:
        e.type === "paid" && earlyDeadline ? earlyDeadline : null,
      sortOrder: e.sortOrder,
    }));
    const insertedEvents = await tx
      .insert(events)
      .values(eventInserts)
      .returning();
    result.events = insertedEvents.length;

    const eventBySlug = new Map(insertedEvents.map((e) => [e.slug, e]));
    const banquetEvent = eventBySlug.get("saturday-banquet")!;
    const tailgateEvent = eventBySlug.get("friday-tailgate")!;
    const barEvent = eventBySlug.get("friday-bar")!;
    const serviceEvent = eventBySlug.get("saturday-service")!;
    const banquetPriceCents = banquetEvent.priceCents ?? 9500;

    // ----- RSVPs + registrationEvents + profiles -----
    // Mix: ~70% paid online, ~20% paid at door, ~10% pending. 7 of 10 get
    // published profiles to keep yearbook non-empty. Deterministic per
    // sortOrder so re-seeded demo tenants look identical.
    const insertedRsvpIds: string[] = [];
    for (let i = 0; i < DEMO_SAMPLE_PEOPLE.length; i++) {
      const person = DEMO_SAMPLE_PEOPLE[i];
      // Deterministic payment status by index — avoids Math.random so
      // multiple seedings produce identical demo state.
      const isOnlinePaid = i % 10 < 7; // 0-6 → paid online
      const isDoor = !isOnlinePaid && i % 10 < 9; // 7-8 → pay at door
      // i === 9 → pending
      const guestCount = (i % 3) + 1;
      const editToken = crypto.randomUUID();
      const [row] = await tx
        .insert(rsvps)
        .values({
          reunionId,
          firstName: person.firstName,
          lastName: person.lastName,
          email: tagEmail(person.emailLocal),
          guestCount,
          editToken,
          paymentMethod: isDoor ? "door" : "online",
          paymentStatus: isOnlinePaid
            ? "paid"
            : isDoor
              ? "pending"
              : "pending",
          amountPaidCents: isOnlinePaid ? banquetPriceCents : 0,
          donationCents: isOnlinePaid ? Math.round(banquetPriceCents * 0.05) : 0,
        })
        .returning();
      insertedRsvpIds.push(row.id);

      // Event registrations — banquet for everyone (paid event), plus a
      // varying selection of interest-only events. Deterministic patterns
      // by index so the demo dataset is reproducible.
      const eventIds: string[] = [banquetEvent.id];
      if (i % 3 !== 0) eventIds.push(tailgateEvent.id);
      if (i % 4 !== 0) eventIds.push(barEvent.id);
      if (i % 5 === 0) eventIds.push(serviceEvent.id);
      await tx.insert(registrationEvents).values(
        eventIds.map((eventId) => ({ rsvpId: row.id, eventId }))
      );
      result.registrationEvents += eventIds.length;

      // Profiles: first 7 of 10 get published profiles.
      if (i < 7) {
        await tx.insert(profiles).values({
          rsvpId: row.id,
          currentCity: person.city,
          occupation: person.occupation,
          family: person.family,
          // Field rename to favoriteSchoolMemory is Phase 3.1 — until
          // then, write to the existing favoritePHMemory column for
          // schema compatibility. Phase 6 backfill will copy old → new
          // for any rows that need it.
          favoritePHMemory: person.memory,
          beenUpTo: person.upTo,
          funFact: person.funFact,
          isPublished: true,
        });
        result.profiles += 1;
      }
    }
    result.rsvps = insertedRsvpIds.length;

    // ----- Sponsors -----
    const sponsorInserts = DEMO_SPONSORS.map((s) => ({
      reunionId,
      contactName: s.contactName,
      contactEmail: tagEmail(s.emailLocal),
      companyName: s.companyName,
      websiteUrl: s.websiteUrl,
      amountCents: s.amountCents,
      tier: getSponsorTier(s.amountCents),
      message: s.message,
      paymentStatus: "paid" as const,
      isDisplayed: true,
    }));
    await tx.insert(sponsors).values(sponsorInserts);
    result.sponsors = sponsorInserts.length;

    // ----- Memorial -----
    await tx.insert(memorials).values({
      reunionId,
      deceasedFirstName: DEMO_MEMORIAL.deceasedFirstName,
      deceasedLastName: DEMO_MEMORIAL.deceasedLastName,
      yearOfBirth: DEMO_MEMORIAL.yearOfBirth,
      yearOfDeath: DEMO_MEMORIAL.yearOfDeath,
      tributeText: DEMO_MEMORIAL.tributeText,
      submitterName: DEMO_MEMORIAL.submitterName,
      submitterEmail: tagEmail(DEMO_MEMORIAL.submitterEmailLocal),
      submitterRelationship: DEMO_MEMORIAL.submitterRelationship,
      status: "published",
      adminDraft: JSON.stringify({
        deceasedFirstName: DEMO_MEMORIAL.deceasedFirstName,
        deceasedLastName: DEMO_MEMORIAL.deceasedLastName,
        yearOfBirth: DEMO_MEMORIAL.yearOfBirth,
        yearOfDeath: DEMO_MEMORIAL.yearOfDeath,
        tributeText: DEMO_MEMORIAL.tributeText,
      }),
    });
    result.memorials = 1;

    // ----- Interest signups + event interests -----
    for (let i = 0; i < DEMO_INTEREST_SIGNUPS.length; i++) {
      const interest = DEMO_INTEREST_SIGNUPS[i];
      const [signup] = await tx
        .insert(interestSignups)
        .values({
          reunionId,
          email: tagEmail(interest.emailLocal),
          firstName: interest.firstName,
          lastName: interest.lastName,
        })
        .returning();
      result.interestSignups += 1;

      // Deterministic event interest selection per index.
      const allEventIds = [
        tailgateEvent.id,
        barEvent.id,
        serviceEvent.id,
        banquetEvent.id,
      ];
      // Each signup expresses interest in 2-4 events, alternating responses.
      const responses: ("yes" | "maybe" | "no")[] = [
        "yes",
        "maybe",
        "yes",
        "no",
      ];
      const picks = allEventIds.filter((_, idx) => (i + idx) % 5 !== 4);
      if (picks.length > 0) {
        await tx.insert(eventInterests).values(
          picks.map((eventId, idx) => ({
            interestSignupId: signup.id,
            eventId,
            response: responses[(i + idx) % responses.length],
          }))
        );
        result.eventInterests += picks.length;
      }
    }

    // ----- Community service backfill (only when null) -----
    if (!reunion.communityServiceProjectName) {
      await tx
        .update(reunions)
        .set({
          communityServiceProjectName:
            DEMO_COMMUNITY_SERVICE_CONFIG.projectName,
          communityServiceCharityName:
            DEMO_COMMUNITY_SERVICE_CONFIG.charityName,
          communityServiceTeaserCopy:
            DEMO_COMMUNITY_SERVICE_CONFIG.teaserCopy,
          communityServiceFullCopy: DEMO_COMMUNITY_SERVICE_CONFIG.fullCopy,
        })
        .where(eq(reunions.id, reunionId));
      result.communityServiceBackfilled = true;
    }
  });

  return result;
}
