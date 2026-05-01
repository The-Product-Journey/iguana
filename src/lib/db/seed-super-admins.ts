/**
 * Seed super_admins rows.
 *
 * Usage (from project root):
 *   SUPER_ADMIN_EMAILS="ryan@productjourney.org" npm run db:seed-super-admins
 *
 * Idempotent — duplicate emails are skipped via the unique index.
 *
 * The bootstrap row (the first super admin) is the only one ever inserted
 * with invitedByEmail=null, marking it as a system bootstrap. Every other
 * super admin must be invited by an existing super admin via the admin UI.
 *
 * If an INVITED_BY_EMAIL env var is set, it is recorded as the inviter for
 * every row inserted in this run. Useful for emergency CLI rescue when an
 * existing super admin needs to add someone but the UI is unreachable.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { superAdmins } from "./schema";

async function seedSuperAdmins() {
  const emailsRaw = process.env.SUPER_ADMIN_EMAILS;
  const invitedBy = process.env.INVITED_BY_EMAIL ?? null;

  if (!emailsRaw) {
    console.error(
      "SUPER_ADMIN_EMAILS env var is required.\n" +
        "Example:\n" +
        '  SUPER_ADMIN_EMAILS="ryan@productjourney.org" npm run db:seed-super-admins'
    );
    process.exit(1);
  }

  const emails = emailsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("SUPER_ADMIN_EMAILS produced no usable values after parsing.");
    process.exit(1);
  }

  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  let inserted = 0;
  let skipped = 0;
  for (const email of emails) {
    try {
      await db.insert(superAdmins).values({ email, invitedByEmail: invitedBy });
      console.log(`  + ${email}${invitedBy ? ` (invited by ${invitedBy})` : " (bootstrap)"}`);
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") || msg.includes("idx_super_admins")) {
        console.log(`  · ${email} (already a super admin — skipped)`);
        skipped++;
      } else {
        console.error(`  ! ${email} — ${msg}`);
      }
    }
  }

  console.log(`\nDone. inserted=${inserted} skipped=${skipped}`);
}

seedSuperAdmins()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
