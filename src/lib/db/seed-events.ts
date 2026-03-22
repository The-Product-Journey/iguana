import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { reunions, events } from "./schema";

async function seedEvents() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  // Get existing reunion
  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, "phhs-1996"))
    .get();

  if (!reunion) {
    console.error("Reunion not found! Run the original seed first.");
    process.exit(1);
  }

  // Update reunion to tease mode
  await db
    .update(reunions)
    .set({ siteMode: "tease" })
    .where(eq(reunions.id, reunion.id));

  console.log("Updated reunion to tease mode");

  // Check if events already exist
  const existingEvents = await db
    .select()
    .from(events)
    .where(eq(events.reunionId, reunion.id));

  if (existingEvents.length > 0) {
    console.log(`Events already exist (${existingEvents.length}), skipping.`);
    process.exit(0);
  }

  // Create events
  await db.insert(events).values([
    {
      reunionId: reunion.id,
      name: "Friday Night Tailgate",
      slug: "friday-tailgate",
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
      reunionId: reunion.id,
      name: "Friday Night at Kelly Barges",
      slug: "friday-bar",
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
      reunionId: reunion.id,
      name: "Saturday Community Service",
      slug: "saturday-service",
      description:
        "Give back to the Park Hill community. We're partnering with a local charity for a morning of community service — likely school supply backpack stuffing.",
      eventDate: "2026-08-29",
      eventTime: "9:00 AM",
      eventLocation: "TBD",
      type: "interest_only",
      sortOrder: 3,
    },
    {
      reunionId: reunion.id,
      name: "Saturday Evening Banquet",
      slug: "saturday-banquet",
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
  ]);

  console.log("Seeded 4 events successfully!");
  process.exit(0);
}

seedEvents().catch((e) => {
  console.error("Seed events failed:", e);
  process.exit(1);
});
