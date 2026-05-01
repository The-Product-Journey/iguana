/**
 * CLI wrapper around `seedDemoTenant`.
 *
 * Usage:
 *   REUNION_SLUG=phhs-1996-test npm run db:seed-demo
 *
 * The runtime callers (CreateTenant API + Re-seed endpoint) call
 * `seedDemoTenant` directly through the existing `db` proxy. This CLI
 * exists for the operator path: dropping demo data into an arbitrary slug
 * for QA, demos, or after a manual `wipe-test`.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { reunions } from "./schema";
import * as schema from "./schema";
import { seedDemoTenant, TenantNotEmptyError } from "./seed-demo";

async function main() {
  const slug = process.env.REUNION_SLUG;
  if (!slug) {
    console.error(
      "REUNION_SLUG is required.\n  Example: REUNION_SLUG=acme-2025 npm run db:seed-demo"
    );
    process.exit(1);
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  try {
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.slug, slug))
      .get();
    if (!reunion) {
      console.error(`No reunion found with slug "${slug}".`);
      return 1;
    }

    console.log(`Seeding demo data for "${reunion.name}" (${reunion.id})…`);
    const result = await seedDemoTenant(db, reunion.id);
    console.log("[seed-demo] Done.", result);
    return 0;
  } catch (err) {
    if (err instanceof TenantNotEmptyError) {
      console.error(`[seed-demo] Refusing — tenant is not empty.`);
      for (const t of err.nonEmptyTables) {
        console.error(`  ${t.table}: ${t.count} row(s)`);
      }
      console.error(
        `Wipe the tenant first if a fresh demo dataset is what you want.`
      );
      return 2;
    }
    throw err;
  } finally {
    client.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Seed demo failed:", e);
    process.exit(1);
  });
