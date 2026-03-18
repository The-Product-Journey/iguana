import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  registrationFeeCents: integer("registration_fee_cents").notNull().default(5000),
  maxAttendees: integer("max_attendees"),
  registrationOpen: integer("registration_open", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

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

export type Reunion = typeof reunions.$inferSelect;
export type NewReunion = typeof reunions.$inferInsert;
export type Rsvp = typeof rsvps.$inferSelect;
export type NewRsvp = typeof rsvps.$inferInsert;
