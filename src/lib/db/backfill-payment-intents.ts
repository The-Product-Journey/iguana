/**
 * One-time (or re-runnable) backfill: for every rsvps and sponsors row
 * that has a stripeCheckoutSessionId but no stripePaymentIntentId,
 * retrieve the Checkout Session from Stripe and write the resolved
 * payment_intent back to the row.
 *
 * Run via:
 *   npx tsx --env-file=.env.local src/lib/db/backfill-payment-intents.ts
 *
 * Idempotent — already-backfilled rows are skipped because the WHERE
 * clause filters on stripePaymentIntentId IS NULL.
 *
 * Honors stripeEnvironment(): the script can only retrieve sessions
 * that match the active Stripe key set (test vs live). To backfill
 * across both environments you run it once on each deploy / each
 * key set. Sessions that don't match the current environment are
 * skipped with a logged note.
 */
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { rsvps, sponsors } from "./schema";
import { getStripe, stripeEnvironment } from "@/lib/stripe";

async function backfill<T extends { id: string; stripeCheckoutSessionId: string | null }>(
  rows: T[],
  table: typeof rsvps | typeof sponsors,
  label: string
) {
  const stripe = getStripe();
  const env = stripeEnvironment();
  const expectedPrefix = env === "live" ? "cs_live_" : "cs_test_";
  let filled = 0;
  let skippedEnv = 0;
  let failed = 0;

  for (const row of rows) {
    const sessionId = row.stripeCheckoutSessionId;
    if (!sessionId) continue;
    if (!sessionId.startsWith(expectedPrefix)) {
      skippedEnv++;
      continue;
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      if (!piId) {
        console.log(`  [${label}] ${row.id} — session has no payment_intent (likely incomplete), skipping`);
        continue;
      }
      await db
        .update(table)
        .set({ stripePaymentIntentId: piId })
        .where(eq(table.id, row.id));
      filled++;
      console.log(`  [${label}] ${row.id} → ${piId}`);
    } catch (err) {
      failed++;
      console.error(
        `  [${label}] ${row.id} — retrieve failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `[${label}] filled=${filled} skipped-cross-env=${skippedEnv} failed=${failed}`
  );
}

async function main() {
  const env = stripeEnvironment();
  console.log(`Backfilling payment_intent IDs (env=${env})...`);

  const rsvpRows = await db
    .select({
      id: rsvps.id,
      stripeCheckoutSessionId: rsvps.stripeCheckoutSessionId,
    })
    .from(rsvps)
    .where(
      and(
        isNotNull(rsvps.stripeCheckoutSessionId),
        isNull(rsvps.stripePaymentIntentId)
      )
    )
    .all();
  console.log(`Found ${rsvpRows.length} rsvps row(s) needing backfill`);
  await backfill(rsvpRows, rsvps, "rsvps");

  const sponsorRows = await db
    .select({
      id: sponsors.id,
      stripeCheckoutSessionId: sponsors.stripeCheckoutSessionId,
    })
    .from(sponsors)
    .where(
      and(
        isNotNull(sponsors.stripeCheckoutSessionId),
        isNull(sponsors.stripePaymentIntentId)
      )
    )
    .all();
  console.log(`Found ${sponsorRows.length} sponsors row(s) needing backfill`);
  await backfill(sponsorRows, sponsors, "sponsors");

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
