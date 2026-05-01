/**
 * Seed reunion_admins rows for a given reunion slug.
 *
 * Usage (from project root):
 *   REUNION_SLUG=phhs-1996 \
 *   ADMIN_EMAILS="alice@example.com,bob@example.com" \
 *   npm run db:seed-admins
 *
 * Idempotent — duplicate (reunionId, email) pairs are skipped via the
 * unique index. Logs each insert and any skip.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { reunions, reunionAdmins } from "./schema";

async function seedAdmins() {
  const slug = process.env.REUNION_SLUG;
  const emailsRaw = process.env.ADMIN_EMAILS;
  const invitedBy = process.env.INVITED_BY_EMAIL ?? null;

  if (!slug || !emailsRaw) {
    console.error(
      "REUNION_SLUG and ADMIN_EMAILS env vars are required.\n" +
        "Example:\n" +
        '  REUNION_SLUG=phhs-1996 ADMIN_EMAILS="a@x.com,b@x.com" npm run db:seed-admins'
    );
    process.exit(1);
  }

  const emails = emailsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("ADMIN_EMAILS produced no usable values after parsing.");
    process.exit(1);
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (!reunion) {
    console.error(`No reunion found with slug "${slug}".`);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const email of emails) {
    try {
      await db.insert(reunionAdmins).values({
        reunionId: reunion.id,
        email,
        invitedByEmail: invitedBy,
      });
      console.log(`  + ${email}`);
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") || msg.includes("idx_reunion_admins")) {
        console.log(`  · ${email} (already an admin — skipped)`);
        skipped++;
      } else {
        console.error(`  ! ${email} — ${msg}`);
      }
    }
  }

  console.log(
    `\nDone. inserted=${inserted} skipped=${skipped} reunion=${reunion.name}`
  );
}

seedAdmins()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
