/**
 * Wipe + reseed the test tenant with the generic demo dataset.
 *
 * Phase 2 multi-tenant change: this script no longer mirrors the live
 * PHHS reunion or carries PHHS-flavored sample data inline. It uses
 * `loadGenericShell` for the reunion shell and delegates row-level
 * sample data to `seedDemoTenant`. The slug `phhs-1996-test` is kept
 * for backward compat with bookmarks and ops scripts.
 *
 * Stripe Connect linkage is preserved across the wipe so the test
 * tenant's Stripe onboarding doesn't have to be redone every time
 * sample data is refreshed. Use `npm run db:wipe-test` for the
 * nuclear-clean variant that also drops Stripe linkage.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { reunions } from "./schema";
import {
  wipeTestTenant,
  loadGenericShell,
  TEST_REUNION_SLUG,
} from "./test-tenant";
import { seedDemoTenant } from "./seed-demo";

async function seedTest() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  console.log(
    `Wiping any existing test tenant data (preserving Stripe Connect)…`
  );
  const stripeLinkage = await wipeTestTenant(db, { preserveStripe: true });
  if (stripeLinkage) {
    console.log(
      `Preserved Stripe linkage: ${stripeLinkage.stripeConnectedAccountId}`
    );
  }

  // Generic shell — the test tenant now stands on its own (no PHHS mirror).
  // Default to siteMode=tease so seed-test starts the same way wipe-test
  // does — admins (and you) progress through tease → pre_register → open
  // via the admin toggle (or just preview other modes via the admin
  // banner).
  const shell = loadGenericShell();
  const [reunion] = await db
    .insert(reunions)
    .values({
      slug: TEST_REUNION_SLUG,
      ...shell,
      registrationOpen: false,
      siteMode: "tease",
      stripeConnectedAccountId:
        stripeLinkage?.stripeConnectedAccountId ?? null,
      stripeConnectOnboardingComplete:
        stripeLinkage?.stripeConnectOnboardingComplete ?? false,
      stripeConnectChargesEnabled:
        stripeLinkage?.stripeConnectChargesEnabled ?? false,
      stripeConnectPayoutsEnabled:
        stripeLinkage?.stripeConnectPayoutsEnabled ?? false,
    })
    .returning();
  console.log(`Created test reunion (${reunion.slug})`);

  const result = await seedDemoTenant(db, reunion.id);
  console.log("[seed-test] Demo data laid down.", result);

  console.log("\n--- Test environment ready! ---");
  console.log(`Browse: http://localhost:3000/${TEST_REUNION_SLUG}`);
  console.log(`Admin:  http://localhost:3000/admin/${TEST_REUNION_SLUG}`);
  console.log("");
  console.log(
    `To reset to an empty tenant (onboarding test), run: npm run db:wipe-test`
  );
  client.close();
  return 0;
}

seedTest()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Test seed failed:", e);
    process.exit(1);
  });
