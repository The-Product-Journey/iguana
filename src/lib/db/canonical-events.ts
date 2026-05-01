// The four canonical itinerary events for the PHHS '96 reunion.
// Used by both seed-events (prod) and seed-test (test) so the two tenants
// always render the same set of events with identical names, descriptions,
// and tentative-timeframe labels.
//
// Strict null-only contract on confirmed-detail fields (eventTime,
// eventLocation, eventAddress): use null when a value isn't locked, never
// "TBD" or other placeholder strings. The schedule "details finalizing"
// banner detects null fields. Tentative labels live in `tentativeLabel`.

export const ITINERARY_SLUGS = [
  "friday-tailgate",
  "friday-bar",
  "saturday-service",
  "saturday-banquet",
] as const;

export type ItinerarySlug = (typeof ITINERARY_SLUGS)[number];

export type CanonicalEvent = {
  slug: ItinerarySlug;
  name: string;
  description: string;
  eventDate: string;
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

export const CANONICAL_EVENTS: CanonicalEvent[] = [
  {
    slug: "friday-tailgate",
    name: "Football Game Tailgate",
    description:
      "Tailgate at Park Hill High School for the football home opener. Food truck on site. Simple cover charge at the gate.",
    eventDate: "2026-08-28",
    eventTime: null,
    eventLocation: "Park Hill High School",
    eventAddress: "7701 NW Barry Rd, Kansas City, MO 64153",
    tentativeLabel: "Friday, time is TBD",
    type: "interest_only",
    sortOrder: 1,
  },
  {
    slug: "friday-bar",
    name: "Live Music & Food (a la carte)",
    description:
      "Live band, streaming of the Park Hill football game, and good times. Drinks and food on your own tab.",
    eventDate: "2026-08-28",
    eventTime: null,
    eventLocation: "Kelly Barges",
    eventAddress: "Platte Woods, MO",
    tentativeLabel: "Friday After Tailgate",
    type: "interest_only",
    sortOrder: 2,
  },
  {
    slug: "saturday-service",
    name: "Saturday Community Service",
    description:
      "Give back to the Park Hill community. We're partnering with Replenish KC to fill 96 backpacks of school supplies for Park Hill students.",
    eventDate: "2026-08-29",
    eventTime: null,
    eventLocation: null,
    eventAddress: null,
    tentativeLabel: "Saturday Morning - TBD",
    type: "interest_only",
    sortOrder: 3,
  },
  {
    slug: "saturday-banquet",
    name: "Saturday Evening Banquet",
    description:
      "The main event! Dinner, drinks, and an evening of reconnecting with your fellow Trojans at The Olde Mill in Parkville.",
    eventDate: "2026-08-29",
    eventTime: null,
    eventLocation: "The Olde Mill",
    eventAddress: "Parkville, MO",
    tentativeLabel: "Saturday evening - TBD",
    type: "paid",
    priceCents: 9876,
    earlyPriceCents: 7500,
    earlyPriceDeadline: "2026-07-01",
    sortOrder: 4,
  },
];
