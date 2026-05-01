// Wipe the test tenant (`phhs-1996-test`) back to a bare, empty reunion
// record. This mimics the state of a freshly-created production tenant —
// no events, no Stripe Connect, siteMode=tease, registrationOpen=false.
// Use it to test the onboarding flow end-to-end.
//
// Run: npm run db:wipe-test
//
// To populate with sample data after wiping, run: npm run db:seed-test
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  wipeTestTenant,
  createBareTestReunion,
  TEST_REUNION_SLUG,
} from "./test-tenant";

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  try {
    console.log(`Wiping test tenant "${TEST_REUNION_SLUG}"…`);
    await wipeTestTenant(db);
    const reunion = await createBareTestReunion(db);
    console.log(`Created bare empty test reunion (id=${reunion.id}).`);
    console.log("");
    console.log("Test tenant reset to empty state — looks like a freshly-created tenant.");
    console.log(`Browse: http://localhost:3000/${TEST_REUNION_SLUG}`);
    console.log(`Admin:  http://localhost:3000/admin/${TEST_REUNION_SLUG}`);
    console.log("");
    console.log("To populate with sample data, run: npm run db:seed-test");
    return 0;
  } finally {
    client.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Wipe test failed:", e);
    process.exit(1);
  });
