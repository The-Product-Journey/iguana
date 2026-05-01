import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import {
  reunions,
  events,
  registrationEvents,
  eventInterests,
} from "./schema";

const REUNION_SLUG = "phhs-1996";

// Canonical itinerary slugs — must match ITINERARY_SLUGS in src/app/[slug]/schedule/page.tsx
const ITINERARY_SLUGS = [
  "friday-tailgate",
  "friday-bar",
  "saturday-service",
  "saturday-banquet",
] as const;

type EventSeed = {
  slug: (typeof ITINERARY_SLUGS)[number];
  name: string;
  description: string;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  eventAddress: string | null;
  type: "interest_only" | "paid";
  priceCents?: number;
  earlyPriceCents?: number;
  earlyPriceDeadline?: string;
  sortOrder: number;
};

// Strict content rule: any field that is not yet confirmed (eventTime, eventLocation,
// eventAddress) must be `null` — never "TBD" or other placeholder text. The schedule
// banner detects null fields, not strings.
const EVENT_SEEDS: EventSeed[] = [
  {
    slug: "friday-tailgate",
    name: "Friday Night Tailgate",
    description:
      "Tailgate at Park Hill High School for the football home opener. Food truck on site. Simple cover charge at the gate.",
    eventDate: "2026-08-28",
    eventTime: "5:00 PM",
    eventLocation: "Park Hill High School",
    eventAddress: "7701 NW Barry Rd, Kansas City, MO 64153",
    type: "interest_only",
    sortOrder: 1,
  },
  {
    slug: "friday-bar",
    name: "Friday Night at Kelly Barges",
    description:
      "Live band, streaming of the Park Hill football game, and good times. Drinks and food on your own tab.",
    eventDate: "2026-08-28",
    eventTime: "8:00 PM",
    eventLocation: "Kelly Barges",
    eventAddress: "Platte Woods, MO",
    type: "interest_only",
    sortOrder: 2,
  },
  {
    slug: "saturday-service",
    name: "Saturday Community Service — 96 Backpacks",
    description:
      "Give back to the Park Hill community. We're partnering with Replenish KC to fill 96 backpacks of school supplies for Park Hill students.",
    eventDate: "2026-08-29",
    eventTime: null,
    eventLocation: null,
    eventAddress: null,
    type: "interest_only",
    sortOrder: 3,
  },
  {
    slug: "saturday-banquet",
    name: "Saturday Evening Banquet",
    description:
      "The main event! Dinner, drinks, and an evening of reconnecting with your fellow Trojans at The Olde Mill in Parkville.",
    eventDate: "2026-08-29",
    eventTime: "6:00 PM",
    eventLocation: "The Olde Mill",
    eventAddress: "Parkville, MO",
    type: "paid",
    priceCents: 9876,
    earlyPriceCents: 7500,
    earlyPriceDeadline: "2026-07-01",
    sortOrder: 4,
  },
];

async function seedEvents() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  try {
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.slug, REUNION_SLUG))
      .get();

    if (!reunion) {
      console.error("Reunion not found! Run the original seed first.");
      return 1;
    }

    const summary = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      skipped: [] as { slug: string; signups: number; interests: number }[],
      duplicateCanonicalSlugs: [] as { slug: string; count: number }[],
    };

    // Load all existing events for this reunion once
    const existing = await db
      .select()
      .from(events)
      .where(eq(events.reunionId, reunion.id));

    // Detect & warn on duplicate canonical slugs (schema has no uniqueness constraint
    // on (reunionId, slug)). The Map below will collapse duplicates so they would
    // otherwise survive the prune silently. Bail out so the admin can clean up by hand.
    const slugCounts = new Map<string, number>();
    for (const ev of existing) {
      slugCounts.set(ev.slug, (slugCounts.get(ev.slug) ?? 0) + 1);
    }
    const canonicalSet = new Set<string>(ITINERARY_SLUGS);
    for (const [slug, count] of slugCounts.entries()) {
      if (count > 1 && canonicalSet.has(slug)) {
        summary.duplicateCanonicalSlugs.push({ slug, count });
        console.warn(
          `[seed-events] Duplicate rows detected for canonical slug "${slug}" (${count} rows). Skipping all mutations — clean up duplicates manually before re-running.`
        );
      }
    }
    if (summary.duplicateCanonicalSlugs.length > 0) {
      console.log("[seed-events] Aborted (duplicates).", summary);
      return 2;
    }

    const existingBySlug = new Map(existing.map((e) => [e.slug, e]));

    // Wrap mutations in a transaction so a mid-run failure leaves the schedule intact
    await db.transaction(async (tx) => {
      // (a) Upsert canonical events
      for (const seed of EVENT_SEEDS) {
        const found = existingBySlug.get(seed.slug);
        const values = {
          reunionId: reunion.id,
          name: seed.name,
          slug: seed.slug,
          description: seed.description,
          eventDate: seed.eventDate,
          eventTime: seed.eventTime,
          eventLocation: seed.eventLocation,
          eventAddress: seed.eventAddress,
          type: seed.type,
          priceCents: seed.priceCents ?? null,
          earlyPriceCents: seed.earlyPriceCents ?? null,
          earlyPriceDeadline: seed.earlyPriceDeadline ?? null,
          sortOrder: seed.sortOrder,
        };

        if (found) {
          await tx.update(events).set(values).where(eq(events.id, found.id));
          summary.updated += 1;
        } else {
          await tx.insert(events).values(values);
          summary.inserted += 1;
        }
      }

      // (b) Prune non-canonical events — but only when FK-dependent rows are zero
      const nonCanonical = existing.filter((e) => !canonicalSet.has(e.slug));

      for (const ev of nonCanonical) {
        const [signupCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(registrationEvents)
          .where(eq(registrationEvents.eventId, ev.id));

        const [interestCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(eventInterests)
          .where(eq(eventInterests.eventId, ev.id));

        const signups = Number(signupCount?.count ?? 0);
        const interests = Number(interestCount?.count ?? 0);

        if (signups === 0 && interests === 0) {
          await tx.delete(events).where(eq(events.id, ev.id));
          summary.deleted += 1;
        } else {
          summary.skipped.push({ slug: ev.slug, signups, interests });
          console.warn(
            `[seed-events] Skipped delete for non-canonical event "${ev.slug}" (id=${ev.id}) — has ${signups} signup(s), ${interests} interest(s). Clean up manually if needed.`
          );
        }
      }
    });

    console.log("[seed-events] Done.", summary);
    return 0;
  } finally {
    client.close();
  }
}

seedEvents()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Seed events failed:", e);
    process.exit(1);
  });
