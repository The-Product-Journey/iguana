import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import {
  reunions,
  events,
  registrationEvents,
  eventInterests,
} from "./schema";
import { CANONICAL_EVENTS, ITINERARY_SLUGS } from "./canonical-events-phhs";

const REUNION_SLUG = "phhs-1996";

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
      for (const seed of CANONICAL_EVENTS) {
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
          tentativeLabel: seed.tentativeLabel,
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
