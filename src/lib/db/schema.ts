import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Reunions
// ---------------------------------------------------------------------------
export const reunions = sqliteTable("reunions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  eventLocation: text("event_location"),
  eventAddress: text("event_address"),
  registrationFeeCents: integer("registration_fee_cents")
    .notNull()
    .default(5000),
  maxAttendees: integer("max_attendees"),
  // Legacy — kept for backward compat; new code reads siteMode instead
  registrationOpen: integer("registration_open", { mode: "boolean" })
    .notNull()
    .default(false),
  siteMode: text("site_mode", {
    enum: ["tease", "pre_register", "open"],
  })
    .notNull()
    .default("tease"),
  stripeConnectedAccountId: text("stripe_connected_account_id"),
  stripeConnectOnboardingComplete: integer(
    "stripe_connect_onboarding_complete",
    { mode: "boolean" }
  ).default(false),
  stripeConnectChargesEnabled: integer("stripe_connect_charges_enabled", {
    mode: "boolean",
  }).default(false),
  stripeConnectPayoutsEnabled: integer("stripe_connect_payouts_enabled", {
    mode: "boolean",
  }).default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Events (per-reunion)
// ---------------------------------------------------------------------------
export const events = sqliteTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reunionId: text("reunion_id")
    .notNull()
    .references(() => reunions.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  eventLocation: text("event_location"),
  eventAddress: text("event_address"),
  type: text("type", { enum: ["interest_only", "paid"] })
    .notNull()
    .default("interest_only"),
  // Optional human-friendly tentative timeframe label (e.g. "Friday, time
  // is TBD", "Saturday Morning - TBD"). Used on interest/registration forms
  // when exact details aren't locked yet. Independent of eventTime — the
  // schedule page uses eventTime; informal forms prefer this when present.
  tentativeLabel: text("tentative_label"),
  priceCents: integer("price_cents"),
  earlyPriceCents: integer("early_price_cents"),
  earlyPriceDeadline: text("early_price_deadline"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// RSVPs (extended with editToken + paymentMethod)
// ---------------------------------------------------------------------------
export const rsvps = sqliteTable(
  "rsvps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reunionId: text("reunion_id")
      .notNull()
      .references(() => reunions.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    guestCount: integer("guest_count").notNull().default(1),
    dietaryNotes: text("dietary_notes"),
    message: text("message"),
    editToken: text("edit_token").unique(),
    paymentMethod: text("payment_method", { enum: ["online", "door"] }).default(
      "online"
    ),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    paymentStatus: text("payment_status", {
      enum: ["pending", "paid", "failed", "refunded"],
    })
      .notNull()
      .default("pending"),
    amountPaidCents: integer("amount_paid_cents").default(0),
    donationCents: integer("donation_cents").default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_rsvps_reunion_id").on(table.reunionId),
    index("idx_rsvps_email").on(table.email),
    index("idx_rsvps_payment_status").on(table.paymentStatus),
  ]
);

// ---------------------------------------------------------------------------
// Registration ↔ Event junction
// ---------------------------------------------------------------------------
export const registrationEvents = sqliteTable(
  "registration_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    rsvpId: text("rsvp_id")
      .notNull()
      .references(() => rsvps.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
  },
  (table) => [
    uniqueIndex("idx_reg_events_rsvp_event").on(table.rsvpId, table.eventId),
  ]
);

// ---------------------------------------------------------------------------
// Interest signups (lightweight email capture for tease mode)
// ---------------------------------------------------------------------------
export const interestSignups = sqliteTable(
  "interest_signups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reunionId: text("reunion_id")
      .notNull()
      .references(() => reunions.id),
    email: text("email").notNull(),
    // Full name as entered by the user (preferred for new signups)
    name: text("name"),
    // Optional maiden name / previous last name — useful at reunions where
    // classmates remember each other by their pre-marriage surname
    maidenName: text("maiden_name"),
    // Legacy split name fields — kept for backward compat with older signups
    // and admin views; new signups write to `name` instead
    firstName: text("first_name"),
    lastName: text("last_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("idx_interest_reunion_email").on(table.reunionId, table.email),
  ]
);

// ---------------------------------------------------------------------------
// Interest ↔ Event junction
// ---------------------------------------------------------------------------
export const eventInterests = sqliteTable(
  "event_interests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    interestSignupId: text("interest_signup_id")
      .notNull()
      .references(() => interestSignups.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
  },
  (table) => [
    uniqueIndex("idx_event_interest_signup_event").on(
      table.interestSignupId,
      table.eventId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------
export const sponsors = sqliteTable("sponsors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reunionId: text("reunion_id")
    .notNull()
    .references(() => reunions.id),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  companyName: text("company_name"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  amountCents: integer("amount_cents").notNull(),
  tier: text("tier", { enum: ["top", "community"] }).notNull(),
  message: text("message"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  paymentStatus: text("payment_status", {
    enum: ["pending", "paid", "failed"],
  })
    .notNull()
    .default("pending"),
  isDisplayed: integer("is_displayed", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Profiles (digital yearbook)
// ---------------------------------------------------------------------------
export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  rsvpId: text("rsvp_id")
    .notNull()
    .unique()
    .references(() => rsvps.id),
  currentCity: text("current_city"),
  occupation: text("occupation"),
  family: text("family"),
  favoritePHMemory: text("favorite_ph_memory"),
  beenUpTo: text("been_up_to"),
  funFact: text("fun_fact"),
  photoUrl: text("photo_url"),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Memorials (in memoriam)
// ---------------------------------------------------------------------------
export const memorials = sqliteTable("memorials", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reunionId: text("reunion_id")
    .notNull()
    .references(() => reunions.id),
  deceasedFirstName: text("deceased_first_name").notNull(),
  deceasedLastName: text("deceased_last_name").notNull(),
  deceasedPhotoUrl: text("deceased_photo_url"),
  yearOfBirth: text("year_of_birth"),
  yearOfDeath: text("year_of_death"),
  tributeText: text("tribute_text").notNull(),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  submitterPhone: text("submitter_phone"),
  submitterRelationship: text("submitter_relationship"),
  reviewToken: text("review_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  status: text("status", {
    enum: ["submitted", "draft", "pending_review", "published"],
  })
    .notNull()
    .default("submitted"),
  adminDraft: text("admin_draft"),
  reviewNotes: text("review_notes"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Contact messages (existing)
// ---------------------------------------------------------------------------
export const contactMessages = sqliteTable("contact_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  reunionId: text("reunion_id")
    .notNull()
    .references(() => reunions.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  category: text("category", {
    enum: ["volunteer", "photos", "entertainment", "classmate_passed", "other"],
  })
    .notNull()
    .default("other"),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
export type Reunion = typeof reunions.$inferSelect;
export type NewReunion = typeof reunions.$inferInsert;
export type Rsvp = typeof rsvps.$inferSelect;
export type NewRsvp = typeof rsvps.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type InterestSignup = typeof interestSignups.$inferSelect;
export type NewInterestSignup = typeof interestSignups.$inferInsert;
export type EventInterest = typeof eventInterests.$inferSelect;
export type RegistrationEvent = typeof registrationEvents.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Memorial = typeof memorials.$inferSelect;
export type NewMemorial = typeof memorials.$inferInsert;
