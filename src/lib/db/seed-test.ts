import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  reunions,
  events,
  rsvps,
  registrationEvents,
  profiles,
  sponsors,
  memorials,
  interestSignups,
  eventInterests,
} from "./schema";
import { wipeTestTenant, loadProdShell, TEST_REUNION_SLUG } from "./test-tenant";
import { CANONICAL_EVENTS } from "./canonical-events";

async function seedTest() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  // Wipe-and-re-seed: re-running this script gives a clean baseline. No
  // --force flag — this is the test tenant; that's the whole point.
  // PRESERVE Stripe Connect linkage across the wipe so admins don't have to
  // re-do Stripe onboarding every time they refresh sample data. Use
  // `npm run db:wipe-test` for the nuclear option that also clears Stripe.
  console.log(`Wiping any existing test tenant data (preserving Stripe Connect)…`);
  const stripeLinkage = await wipeTestTenant(db, { preserveStripe: true });
  if (stripeLinkage) {
    console.log(
      `Preserved Stripe linkage: ${stripeLinkage.stripeConnectedAccountId}`
    );
  }

  // Test reunion mirrors prod's shell (name, description, event metadata) so
  // the public site renders identically — no "TEST" labels visible. Only the
  // siteMode/registrationOpen state, the Stripe linkage we just preserved,
  // and the sample data below are test-specific.
  //
  // Default to siteMode=tease so seed-test starts the same way wipe-test does
  // — admins (and you) progress through tease → pre_register → open via the
  // admin toggle (or just preview other modes via the admin banner).
  const shell = await loadProdShell(db);
  const [reunion] = await db
    .insert(reunions)
    .values({
      slug: TEST_REUNION_SLUG,
      ...shell,
      registrationOpen: false,
      siteMode: "tease",
      stripeConnectedAccountId: stripeLinkage?.stripeConnectedAccountId ?? null,
      stripeConnectOnboardingComplete:
        stripeLinkage?.stripeConnectOnboardingComplete ?? false,
      stripeConnectChargesEnabled:
        stripeLinkage?.stripeConnectChargesEnabled ?? false,
      stripeConnectPayoutsEnabled:
        stripeLinkage?.stripeConnectPayoutsEnabled ?? false,
    })
    .returning();

  console.log("Created test reunion (mirroring prod shell)");

  // Events use the shared canonical seed so prod and test stay in sync.
  const eventValues = CANONICAL_EVENTS.map((e) => ({
    reunionId: reunion.id,
    name: e.name,
    slug: e.slug,
    description: e.description,
    eventDate: e.eventDate,
    eventTime: e.eventTime,
    eventLocation: e.eventLocation,
    eventAddress: e.eventAddress,
    tentativeLabel: e.tentativeLabel,
    type: e.type,
    priceCents: e.priceCents ?? null,
    earlyPriceCents: e.earlyPriceCents ?? null,
    earlyPriceDeadline: e.earlyPriceDeadline ?? null,
    sortOrder: e.sortOrder,
  }));

  const createdEvents = await db.insert(events).values(eventValues).returning();
  console.log(`Created ${createdEvents.length} events`);

  const banquetEvent = createdEvents.find((e) => e.slug === "saturday-banquet")!;
  const tailgateEvent = createdEvents.find((e) => e.slug === "friday-tailgate")!;
  const barEvent = createdEvents.find((e) => e.slug === "friday-bar")!;
  const serviceEvent = createdEvents.find((e) => e.slug === "saturday-service")!;

  // Sample RSVPs
  const samplePeople = [
    { firstName: "Sarah", lastName: "Mitchell", email: "sarah.mitchell@example.com", city: "Denver, CO", occupation: "Marketing Director at TechCorp", family: "Married with 2 kids and a golden retriever named Trojan", memory: "Spirit Week junior year when our class float actually won for the first time in a decade", upTo: "Moved to Colorado after college, worked my way up in tech marketing. Spent 3 years in London with the company. Now back stateside and loving the mountain life.", funFact: "I've run 7 marathons and counting" },
    { firstName: "Mike", lastName: "Johnson", email: "mike.j@example.com", city: "Kansas City, MO", occupation: "Owner, Johnson's Auto Body", family: "Wife Lisa (class of '97!), 3 kids", memory: "Friday night football games — nothing beats that feeling of the whole school showing up", upTo: "Never left KC! Took over my dad's auto shop and grew it to 3 locations. Coach little league on weekends.", funFact: "I still have my letterman jacket and yes, it still fits" },
    { firstName: "Jennifer", lastName: "Park", email: "jen.park@example.com", city: "San Francisco, CA", occupation: "Pediatrician", family: "Partner David, twin girls (age 6)", memory: "Mr. Henderson's AP History class debates — I think that's what made me want to help people", upTo: "Med school at Mizzou, residency in Chicago, now practicing in SF. Finally feel settled after years of moving around.", funFact: "I've been to every continent including Antarctica" },
    { firstName: "David", lastName: "Thompson", email: "david.t@example.com", city: "Austin, TX", occupation: "Software Engineer at a startup", family: "Single, loving it", memory: "Battle of the Bands senior year — my band came in dead last but we had the most fun", upTo: "Bummed around after graduation, found computers in my late 20s, self-taught developer. Now building cool stuff in Austin.", funFact: "I can play 6 instruments (badly)" },
    { firstName: "Amanda", lastName: "Rodriguez", email: "amanda.r@example.com", city: "Chicago, IL", occupation: "High school teacher — English Lit", family: "Husband Carlos, son Jake (14)", memory: "The senior prank with the flamingos on the front lawn — still makes me laugh", upTo: "Went to KU, did a stint in publishing in NYC, then realized I wanted to teach. Been at the same school in Chicago for 12 years now.", funFact: "One of my former students is now a published novelist" },
    { firstName: "Chris", lastName: "Baker", email: "chris.baker@example.com", city: "Parkville, MO", occupation: "Financial Advisor", family: "Wife Megan, 4 kids", memory: "Homecoming '95 — the whole weekend was just perfect", upTo: "Stayed local, built a financial planning practice. My oldest just started at Park Hill!", funFact: "I've eaten at every BBQ restaurant in the KC metro area — yes, all of them" },
    { firstName: "Lisa", lastName: "Chen", email: "lisa.chen@example.com", city: "Seattle, WA", occupation: "UX Designer at Amazon", family: "Married to Tom, rescue dog named Pixel", memory: "Art class with Mrs. Williams — she's the reason I'm a designer today", upTo: "Design degree at RISD, bounced between agencies for a while, landed at Amazon 5 years ago. Love the Pacific Northwest.", funFact: "I design escape rooms as a hobby" },
    { firstName: "Brian", lastName: "Williams", email: "brian.w@example.com", city: "Nashville, TN", occupation: "Music Producer", family: "Divorced, 2 kids who are way cooler than me", memory: "Sneaking into the auditorium to play guitar during lunch", upTo: "Chased the music dream to Nashville. Took 10 years to get my break but now I produce records for a living. No complaints.", funFact: "One of my tracks went platinum (no, I won't say which one)" },
    { firstName: "Rachel", lastName: "Kim", email: "rachel.kim@example.com", city: "New York, NY", occupation: "Attorney — Corporate Law", family: "Engaged!", memory: "Mock Trial team — Judge Martinez said our closing argument was the best he'd seen from high schoolers", upTo: "Law school at Georgetown, associate at a big firm in NYC, just made partner last year. Wedding in October!", funFact: "I do competitive ballroom dancing" },
    { firstName: "Jason", lastName: "Murray", email: "jason.m@example.com", city: "Phoenix, AZ", occupation: "Firefighter / Paramedic", family: "Wife Danielle, son and daughter", memory: "Coach Reynolds making us run hills until we couldn't feel our legs — turns out that prepared me for the academy", upTo: "Military for 6 years, then fire academy. Been a firefighter in Phoenix for 15 years. It's the best job in the world.", funFact: "I cook a mean brisket — 16 hours, low and slow" },
  ];

  const createdRsvps = [];
  for (const person of samplePeople) {
    const editToken = crypto.randomUUID();
    const isPaid = Math.random() > 0.3; // 70% paid
    const [rsvp] = await db
      .insert(rsvps)
      .values({
        reunionId: reunion.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        guestCount: Math.ceil(Math.random() * 3),
        editToken,
        paymentMethod: isPaid ? "online" : "door",
        paymentStatus: isPaid ? "paid" : "pending",
        amountPaidCents: isPaid ? 9876 : 0,
        donationCents: isPaid ? Math.round(9876 * 0.05) : 0,
      })
      .returning();
    createdRsvps.push({ rsvp, person });
  }
  console.log(`Created ${createdRsvps.length} sample RSVPs`);

  // Register events for each RSVP
  for (const { rsvp } of createdRsvps) {
    const selectedEvents = [banquetEvent.id];
    if (Math.random() > 0.3) selectedEvents.push(tailgateEvent.id);
    if (Math.random() > 0.5) selectedEvents.push(barEvent.id);
    if (Math.random() > 0.6) selectedEvents.push(serviceEvent.id);

    await db.insert(registrationEvents).values(
      selectedEvents.map((eventId) => ({ rsvpId: rsvp.id, eventId }))
    );
  }
  console.log("Created event registrations");

  // Create profiles for 7 of 10
  for (let i = 0; i < 7; i++) {
    const { rsvp, person } = createdRsvps[i];
    await db.insert(profiles).values({
      rsvpId: rsvp.id,
      currentCity: person.city,
      occupation: person.occupation,
      family: person.family,
      favoritePHMemory: person.memory,
      beenUpTo: person.upTo,
      funFact: person.funFact,
      isPublished: true,
    });
  }
  console.log("Created 7 sample profiles");

  // Sample sponsors
  await db.insert(sponsors).values([
    {
      reunionId: reunion.id,
      contactName: "Chris Baker",
      contactEmail: "chris.baker@example.com",
      companyName: "Baker Financial Group",
      amountCents: 100000,
      tier: "top",
      message: "Proud to support our class! Go Trojans!",
      paymentStatus: "paid",
      isDisplayed: true,
    },
    {
      reunionId: reunion.id,
      contactName: "Mike Johnson",
      contactEmail: "mike.j@example.com",
      companyName: "Johnson's Auto Body",
      websiteUrl: "https://example.com",
      amountCents: 75000,
      tier: "top",
      message: "Three locations serving KC — Class of '96 gets 10% off!",
      paymentStatus: "paid",
      isDisplayed: true,
    },
    {
      reunionId: reunion.id,
      contactName: "Sarah Mitchell",
      contactEmail: "sarah.mitchell@example.com",
      companyName: "Mountain View Marketing",
      amountCents: 25000,
      tier: "community",
      paymentStatus: "paid",
      isDisplayed: true,
    },
  ]);
  console.log("Created 3 sample sponsors");

  // Sample memorial
  await db.insert(memorials).values({
    reunionId: reunion.id,
    deceasedFirstName: "Chuck",
    deceasedLastName: "Harrison",
    yearOfBirth: "1978",
    yearOfDeath: "2021",
    tributeText:
      "Chuck was the heart and soul of our class. His infectious laugh could fill any room, and his kindness touched everyone who knew him. Whether it was organizing pickup basketball games or helping someone with their homework, Chuck was always there. He went on to become an incredible father and community leader. We miss him every day, but his legacy lives on through the lives he touched. Rest easy, brother.",
    submitterName: "Brian Williams",
    submitterEmail: "brian.w@example.com",
    submitterRelationship: "Classmate and close friend",
    status: "published",
    adminDraft: JSON.stringify({
      deceasedFirstName: "Chuck",
      deceasedLastName: "Harrison",
      yearOfBirth: "1978",
      yearOfDeath: "2021",
      tributeText:
        "Chuck was the heart and soul of our class. His infectious laugh could fill any room, and his kindness touched everyone who knew him. Whether it was organizing pickup basketball games or helping someone with their homework, Chuck was always there. He went on to become an incredible father and community leader. We miss him every day, but his legacy lives on through the lives he touched. Rest easy, brother.",
    }),
  });
  console.log("Created 1 sample memorial (published)");

  // Sample interest signups
  const interestEmails = [
    { email: "curious.trojan@example.com", firstName: "Alex", lastName: "Rivera" },
    { email: "maybe.attending@example.com", firstName: "Kelly", lastName: "O'Brien" },
    { email: "planning.trip@example.com", firstName: "Marcus", lastName: "Davis" },
    { email: "nostalgic96@example.com", firstName: null, lastName: null },
    { email: "gotropans@example.com", firstName: "Pat", lastName: "Sullivan" },
  ];

  for (const interest of interestEmails) {
    const [signup] = await db
      .insert(interestSignups)
      .values({
        reunionId: reunion.id,
        email: interest.email,
        firstName: interest.firstName,
        lastName: interest.lastName,
      })
      .returning();

    // Random event interests
    const eventPool = [tailgateEvent.id, barEvent.id, serviceEvent.id, banquetEvent.id];
    const selected = eventPool.filter(() => Math.random() > 0.4);
    if (selected.length > 0) {
      await db.insert(eventInterests).values(
        selected.map((eventId) => ({
          interestSignupId: signup.id,
          eventId,
        }))
      );
    }
  }
  console.log("Created 5 sample interest signups");

  console.log("\n--- Test environment ready! ---");
  console.log(`Browse: http://localhost:3000/${TEST_REUNION_SLUG}`);
  console.log(`Admin:  http://localhost:3000/admin/${TEST_REUNION_SLUG}`);
  console.log("");
  console.log(`To reset to an empty tenant (onboarding test), run: npm run db:wipe-test`);
  client.close();
  return 0;
}

seedTest()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("Test seed failed:", e);
    process.exit(1);
  });
