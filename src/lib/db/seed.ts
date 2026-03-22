import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { reunions, events } from "./schema";

async function seed() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  // Create the reunion
  const [reunion] = await db
    .insert(reunions)
    .values({
      slug: "phhs-1996",
      name: "Park Hill High School — Class of 1996",
      description:
        "Join us for our 30-year reunion! Reconnect with fellow Trojans, share stories, and celebrate three decades since graduation.",
      eventDate: "2026-08-28",
      eventTime: "August 28–29, 2026",
      eventLocation: "The Olde Mill",
      eventAddress: "Parkville, MO",
      registrationFeeCents: 9876,
      registrationOpen: false,
      siteMode: "tease",
      maxAttendees: 300,
    })
    .returning();

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

  console.log("Seeded reunion and events successfully!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
