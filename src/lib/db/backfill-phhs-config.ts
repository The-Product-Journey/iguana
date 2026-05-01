/**
 * One-shot PHHS backfill.
 *
 * Populates the new tenant-config columns (Phase 1) and the new profiles
 * column (`favoriteSchoolMemory`, Phase 3.1) for the live PHHS reunion
 * row + its profiles. After this script runs in each environment, the
 * live PHHS site renders identically to its pre-multi-tenant state.
 *
 * Run order matters:
 *   1. Deploy the schema changes (db:push) so the new columns exist.
 *   2. Deploy the application code so getTenantConfig is reading them.
 *   3. Run this backfill so the columns have PHHS-specific values.
 *
 * If you run this BEFORE step 1, every UPDATE will fail with "no such
 * column". If you run step 2 before this, the live PHHS site briefly
 * renders with generic defaults (red brand color matches anyway, but
 * the milestone label, banquet label, sponsor tier labels, and
 * community-service block all degrade visibly).
 *
 * Idempotency: only-if-null. Each column is only set when its current
 * value is null, so re-running is safe and won't clobber any edits an
 * admin has made via the Settings UI. The favoritePHMemory →
 * favoriteSchoolMemory copy follows the same rule per row.
 *
 * Usage: npm run db:backfill-phhs-config
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, isNull, and } from "drizzle-orm";
import { reunions, profiles } from "./schema";
import * as schema from "./schema";

const PHHS_SLUG = "phhs-1996";

// Snapshot of every PHHS-flavored value the live site rendered before
// Phase 3 ripped these out of the codebase. Edit only the values you want
// to push into prod.
const PHHS_CONFIG = {
  orgName: "Park Hill High School",
  orgShortName: "PHHS '96",
  mascot: "Trojans",
  classYear: "1996",
  reunionMilestoneLabel: "30 Year Reunion",
  brandColorPrimary: "#b91c1c",
  brandColorPrimaryDark: "#7f1d1d",
  // logoUrl: leave null — no asset uploaded historically.
  communityServiceProjectName: "96 Backpacks",
  communityServiceCharityName: "Replenish KC",
  communityServiceTeaserCopy:
    "Saturday morning, we're assembling 96 backpacks of school supplies for Park Hill students — partnering with Replenish KC.",
  communityServiceFullCopy:
    "On Saturday morning of reunion weekend, we're assembling 96 backpacks filled with school supplies for Park Hill students. It's a hands-on way to start the day together and leave the community a little better than we found it.\n\nWe're partnering with Replenish KC, who will deliver the filled backpacks to Park Hill schools.",
  sponsorTopTierLabel: "Trojan",
  sponsorCommunityTierLabel: "Community Service Project",
  favoriteMemoryLabel: "Favorite Park Hill Memory",
  banquetLabel: "Saturday Banquet",
} as const;

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  try {
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.slug, PHHS_SLUG))
      .get();

    if (!reunion) {
      console.error(
        `[backfill-phhs] No reunion with slug "${PHHS_SLUG}" — nothing to backfill.`
      );
      return 1;
    }

    // Build an only-if-null update payload by inspecting the current row.
    // For every key in PHHS_CONFIG, if the row's column is null, queue it.
    // This way we don't clobber any value an admin has already edited via
    // the Settings UI.
    const updates: Record<string, string> = {};
    let skipped = 0;
    for (const [key, value] of Object.entries(PHHS_CONFIG)) {
      const current = (reunion as unknown as Record<string, unknown>)[key];
      if (current === null || current === undefined) {
        updates[key] = value;
      } else {
        skipped += 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates["updatedAt"] = new Date().toISOString();
      await db
        .update(reunions)
        .set(updates)
        .where(eq(reunions.id, reunion.id));
      console.log(
        `[backfill-phhs] Reunion: set ${Object.keys(updates).length - 1} fields, skipped ${skipped} (already set).`
      );
    } else {
      console.log("[backfill-phhs] Reunion: nothing to backfill.");
    }

    // Profiles: copy favoritePHMemory → favoriteSchoolMemory for any rows
    // where the new column is null but the old one isn't. Scoped via
    // rsvps.reunionId (profiles has no reunionId column).
    const candidates = await db
      .select({
        id: profiles.id,
        favoritePHMemory: profiles.favoritePHMemory,
      })
      .from(profiles)
      .innerJoin(schema.rsvps, eq(profiles.rsvpId, schema.rsvps.id))
      .where(
        and(
          eq(schema.rsvps.reunionId, reunion.id),
          isNull(profiles.favoriteSchoolMemory)
        )
      );

    let copied = 0;
    for (const row of candidates) {
      if (row.favoritePHMemory === null) continue;
      await db
        .update(profiles)
        .set({
          favoriteSchoolMemory: row.favoritePHMemory,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(profiles.id, row.id));
      copied += 1;
    }
    console.log(
      `[backfill-phhs] Profiles: copied favoritePHMemory → favoriteSchoolMemory for ${copied} row(s).`
    );

    console.log("[backfill-phhs] Done.");
    return 0;
  } finally {
    client.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[backfill-phhs] failed", err);
    process.exit(1);
  });
