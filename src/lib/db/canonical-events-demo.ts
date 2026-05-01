// Generic demo canonical events. Used by `seedDemoTenant()` to lay down
// a plausible-but-obviously-not-real reunion so platform demos and freshly
// created tenants ship with content already on the page.
//
// Design choices (see PLAN-tenant-creation.md, decisions D3 + D4):
//  - Realistic-looking generic, not lorem ipsum / "Sample High". Buyers
//    evaluating the platform see something live-looking. Names and venues
//    are made-up but the kind of made-up that signals "obviously demo"
//    on close inspection (e.g. "Riverside Tigers").
//  - Same four-event shape as the PHHS reunion (Friday tailgate / Friday
//    casual / Saturday service / Saturday banquet) so the schedule banner,
//    sponsor recognition copy, and admin tabs all light up the same way.
//  - Strict null-only contract on confirmed-detail fields (eventTime,
//    eventLocation, eventAddress): null when not yet locked, never
//    placeholder strings. Demo data treats every field as confirmed.
//
// `seedDemoTenant()` in `src/lib/db/seed-demo.ts` consumes this module.
// `eventDate` here is a SEED VALUE only — `seedDemoTenant` overrides the
// date with the reunion's own `eventDate` so the demo tenant lands on the
// reunion's calendar, not an arbitrary 2025 placeholder.

export const DEMO_ITINERARY_SLUGS = [
  "friday-tailgate",
  "friday-bar",
  "saturday-service",
  "saturday-banquet",
] as const;

export type DemoItinerarySlug = (typeof DEMO_ITINERARY_SLUGS)[number];

// Mirrors the CanonicalEvent shape from canonical-events-phhs.ts. Kept as a
// separate type to avoid coupling the demo module to PHHS-flavored copy.
export type DemoCanonicalEvent = {
  slug: DemoItinerarySlug;
  name: string;
  description: string;
  eventTime: string | null;
  eventLocation: string | null;
  eventAddress: string | null;
  tentativeLabel: string;
  type: "interest_only" | "paid";
  priceCents?: number;
  earlyPriceCents?: number;
  earlyPriceDeadline?: string;
  sortOrder: number;
};

// Two-day reunion shape: Friday opener + Saturday main event.
// Times are intentionally filled in (no "details finalizing" banner on the
// demo) — the demo tenant should look like a real upcoming reunion.
export const DEMO_CANONICAL_EVENTS: DemoCanonicalEvent[] = [
  {
    slug: "friday-tailgate",
    name: "Friday Tailgate",
    description:
      "Kick off the weekend at the football game tailgate before the home opener. Food truck on site, casual atmosphere, easy way to find your people before the rest of the weekend.",
    eventTime: "5:00 PM",
    eventLocation: "Riverside High School",
    eventAddress: "1200 Lakeside Drive, Riverside",
    tentativeLabel: "Friday Evening",
    type: "interest_only",
    sortOrder: 1,
  },
  {
    slug: "friday-bar",
    name: "Friday Live Music",
    description:
      "Live band, drinks, and good times after the game. Drinks and food on your own tab — meet up, hang out, no agenda.",
    eventTime: "8:30 PM",
    eventLocation: "The Lakeside Tap",
    eventAddress: "Downtown Riverside",
    tentativeLabel: "Friday Night",
    type: "interest_only",
    sortOrder: 2,
  },
  {
    slug: "saturday-service",
    name: "Saturday Community Service",
    description:
      "Give back to the community with a morning of school-supply drive packing for local students. A meaningful way to start the day before the big event.",
    eventTime: "9:00 AM",
    eventLocation: "Riverside Community Center",
    eventAddress: "550 Main Street, Riverside",
    tentativeLabel: "Saturday Morning",
    type: "interest_only",
    sortOrder: 3,
  },
  {
    slug: "saturday-banquet",
    name: "Saturday Evening Banquet",
    description:
      "The main event — dinner, drinks, and an evening of reconnecting with your classmates. Plated dinner, dance floor, photos, and stories that shouldn't have aged this well.",
    eventTime: "6:30 PM",
    eventLocation: "The Riverside Ballroom",
    eventAddress: "Lakeside Resort, Riverside",
    tentativeLabel: "Saturday Evening",
    type: "paid",
    priceCents: 9500, // $95
    earlyPriceCents: 7500, // $75
    // Default early-bird deadline relative to the reunion date is harder to
    // express here — `seedDemoTenant` patches this when it knows the
    // reunion's eventDate. Leaving as a static placeholder; the seeder
    // will override.
    earlyPriceDeadline: undefined,
    sortOrder: 4,
  },
];

// Sample alumni for the demo dataset. Plausible-but-obviously-fictional
// names (no real people; no celebrity references). Spread across cities and
// occupations to make the yearbook page look populated. Realistic memory /
// "what I've been up to" copy keeps it feeling lived-in.
//
// Email addresses use the @example.com TLD per RFC 2606 reservations and
// are namespaced by reunion id at insert time (see seedDemoTenant) to keep
// multiple demo tenants from colliding on the unique-email indexes that
// exist on interest signups.
export type DemoSamplePerson = {
  firstName: string;
  lastName: string;
  emailLocal: string; // local part only — namespaced by reunion id at insert
  city: string;
  occupation: string;
  family: string;
  memory: string;
  upTo: string;
  funFact: string;
};

export const DEMO_SAMPLE_PEOPLE: DemoSamplePerson[] = [
  {
    firstName: "Alex",
    lastName: "Carter",
    emailLocal: "alex.carter",
    city: "Portland, OR",
    occupation: "Product Manager at a software startup",
    family: "Married, two kids and a corgi named Biscuit",
    memory: "Senior year homecoming float — we somehow got the school bus painted in time",
    upTo: "Bounced through three startups, finally settled into one I actually like. Mostly trying to keep up with my kids on the weekends.",
    funFact: "I've completed every Riverside-area trail race at least once",
  },
  {
    firstName: "Jordan",
    lastName: "Bennett",
    emailLocal: "jordan.bennett",
    city: "Riverside",
    occupation: "Owner, Bennett Family Bakery",
    family: "Wife Kayla, one teenager who is too cool for me",
    memory: "Friday night football against our biggest rival — we lost but the parking lot was the best night of the year",
    upTo: "Took over the family bakery, opened a second location two years ago. Coach little league when I can find time.",
    funFact: "My sourdough has won the county fair three years running",
  },
  {
    firstName: "Priya",
    lastName: "Shah",
    emailLocal: "priya.shah",
    city: "Boston, MA",
    occupation: "Pediatrician",
    family: "Partner Maya, one toddler",
    memory: "Mr. Henderson's debate club — that's where I learned to argue, which my wife tells me is now my entire personality",
    upTo: "Med school, residency, just made attending. Slowly figuring out parenthood.",
    funFact: "I've been to all seven continents — Antarctica took some convincing",
  },
  {
    firstName: "Marcus",
    lastName: "Reed",
    emailLocal: "marcus.reed",
    city: "Austin, TX",
    occupation: "Software Engineer",
    family: "Single, a lot of houseplants",
    memory: "Sneaking into the auditorium at lunch to play piano — I was very bad and very dedicated",
    upTo: "Self-taught into tech in my late twenties. Now I write code for a living and complain about meetings.",
    funFact: "I can play five instruments badly and one (the recorder) shockingly well",
  },
  {
    firstName: "Sam",
    lastName: "Ortiz",
    emailLocal: "sam.ortiz",
    city: "Chicago, IL",
    occupation: "High school English teacher",
    family: "Husband Eli, one kid in middle school",
    memory: "Getting our senior prank past the principal — I will not say what it was here",
    upTo: "Publishing degree, then realized I wanted to teach. Twelve years in at the same school in Chicago.",
    funFact: "One of my former students is now a New York Times bestselling author",
  },
  {
    firstName: "Riley",
    lastName: "Kim",
    emailLocal: "riley.kim",
    city: "Seattle, WA",
    occupation: "UX Designer",
    family: "Married to Jess, rescue dog named Pixel",
    memory: "Mrs. Williams's art class — she's the only reason I'm a designer today",
    upTo: "Design degree, agency life, finally landed a senior role I love. The weather is what people say it is.",
    funFact: "I design escape rooms on the side — built one in my garage",
  },
  {
    firstName: "Devon",
    lastName: "Patel",
    emailLocal: "devon.patel",
    city: "Nashville, TN",
    occupation: "Music Producer",
    family: "Divorced, two kids who are way cooler than me",
    memory: "Battle of the Bands senior year — I came in dead last and learned everything I know",
    upTo: "Chased the music dream, took a decade to get a foothold, now produce records full-time. No regrets.",
    funFact: "One of my tracks has gone platinum (I will not say which)",
  },
  {
    firstName: "Noor",
    lastName: "Ali",
    emailLocal: "noor.ali",
    city: "New York, NY",
    occupation: "Attorney — corporate law",
    family: "Engaged, wedding next spring",
    memory: "Mock Trial — Judge Martinez told us our closing argument was the best he'd seen from high schoolers",
    upTo: "Law school, big firm in NYC, just made partner. Wedding planning is somehow harder than law school.",
    funFact: "I do competitive ballroom dancing — usually rumba, sometimes embarrassing",
  },
  {
    firstName: "Tyler",
    lastName: "Nguyen",
    emailLocal: "tyler.nguyen",
    city: "Phoenix, AZ",
    occupation: "Firefighter / Paramedic",
    family: "Wife Danielle, son and daughter",
    memory: "Coach Reynolds running us up hills until we couldn't feel our legs — turns out it prepared me for everything",
    upTo: "Military for six years, then fire academy. Fifteen years on the job. Best work I've ever done.",
    funFact: "I cook a 16-hour brisket and refuse to share the rub",
  },
  {
    firstName: "Casey",
    lastName: "Murray",
    emailLocal: "casey.murray",
    city: "Denver, CO",
    occupation: "Marketing Director",
    family: "Married, one kid, one rescue cat",
    memory: "Spirit Week junior year — our class float won for the first time in a decade and we wouldn't shut up about it",
    upTo: "Worked my way up in tech marketing, did three years in London, now back stateside and loving the mountain life.",
    funFact: "I've run seven marathons and counting — Boston twice, never the time I wanted",
  },
];

// Demo sponsors. The demo dataset includes one Top tier and two Community
// tier so the public sponsors page renders both sections and the admin
// sponsor tab is non-empty.
export type DemoSponsor = {
  contactName: string;
  emailLocal: string;
  companyName: string;
  websiteUrl: string | null;
  amountCents: number;
  message: string | null;
};

export const DEMO_SPONSORS: DemoSponsor[] = [
  {
    contactName: "Jordan Bennett",
    emailLocal: "jordan.bennett",
    companyName: "Bennett Family Bakery",
    websiteUrl: null,
    amountCents: 100000, // $1,000 → top tier
    message:
      "Proud to support our class — drop in for a coffee and a roll while you're in town!",
  },
  {
    contactName: "Marcus Reed",
    emailLocal: "marcus.reed",
    companyName: "Reed Consulting",
    websiteUrl: "https://example.com",
    amountCents: 25000, // $250 → community tier
    message: null,
  },
  {
    contactName: "Casey Murray",
    emailLocal: "casey.murray",
    companyName: "Highline Marketing",
    websiteUrl: null,
    amountCents: 15000, // $150 → community tier
    message: "Cheering everyone on from Denver — see you at the banquet!",
  },
];

// Single sample memorial — kept reverent, generic, no real names.
export const DEMO_MEMORIAL = {
  deceasedFirstName: "Pat",
  deceasedLastName: "Lawson",
  yearOfBirth: "1992",
  yearOfDeath: "2022",
  tributeText:
    "Pat was the kind of person who made every room a little warmer. Whether organizing pickup games at the park or helping a friend move on a Saturday morning, Pat was always there. They went on to become a beloved teacher, a steady friend, and a parent their kids adored. We miss them every day, but their kindness lives on through everyone who knew them.",
  submitterName: "A Classmate",
  submitterEmailLocal: "memorial.submitter",
  submitterRelationship: "Classmate and friend",
};

// Sample interest signups — used when a tenant is in tease/pre_register
// mode. Keeps the admin "Interest" tab populated.
export const DEMO_INTEREST_SIGNUPS = [
  { emailLocal: "demo.interest.1", firstName: "Drew", lastName: "Powell" },
  { emailLocal: "demo.interest.2", firstName: "Robin", lastName: "Garza" },
  { emailLocal: "demo.interest.3", firstName: "Avery", lastName: "Singh" },
  { emailLocal: "demo.interest.4", firstName: null, lastName: null },
  { emailLocal: "demo.interest.5", firstName: "Sloan", lastName: "Becker" },
] as const;

// Demo community-service config that backfills onto the tenant when a
// super admin runs `seedDemoTenant` against a reunion that has no CS
// project configured. Keeps the demo's homepage CS block + dedicated
// /community-service page non-empty and consistent with the seeded
// `saturday-service` event.
export const DEMO_COMMUNITY_SERVICE_CONFIG = {
  projectName: "Riverside School Supply Drive",
  charityName: "Local Schools Foundation",
  teaserCopy:
    "Saturday morning, we're packing school supplies for students in our community — partnering with the Local Schools Foundation.",
  fullCopy:
    "Saturday morning, we're giving back to the community with a school supply drive. We'll pack backpacks of supplies for students at three local schools, in partnership with the Local Schools Foundation.\n\nEveryone's welcome — no special skills needed, just two hours of your time and willingness to dig through boxes of pencils. Whether you can make it or not, you can also contribute through our charity partner — link below.\n\nWe'll close out the morning with coffee and pastries before everyone heads off to get ready for the evening.",
} as const;
