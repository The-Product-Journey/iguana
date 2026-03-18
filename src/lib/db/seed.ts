import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { reunions } from "./schema";

async function seed() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  await db.insert(reunions).values({
    slug: "phhs-1996",
    name: "Park Hill High School — Class of 1996",
    description:
      "Join us for our 30-year reunion! Reconnect with fellow Trojans, share stories, and celebrate three decades since graduation. The Saturday banquet will be held at the Olde Mill in Parkville, MO.",
    eventDate: "2026-08-28",
    eventTime: "August 28–29, 2026",
    eventLocation: "The Olde Mill",
    eventAddress: "Parkville, MO",
    registrationFeeCents: 9876,
    registrationOpen: false,
    maxAttendees: 300,
  });

  console.log("Seeded reunion successfully!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
