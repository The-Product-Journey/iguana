import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { rsvps, sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const rsvpId = session.metadata?.rsvp_id;
    const sponsorId = session.metadata?.sponsor_id;
    const donationCents = parseInt(
      session.metadata?.donation_cents || "0",
      10
    );

    if (rsvpId) {
      await db
        .update(rsvps)
        .set({
          paymentStatus: "paid",
          amountPaidCents: session.amount_total || 0,
          donationCents,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(rsvps.id, rsvpId));
    }

    if (sponsorId) {
      await db
        .update(sponsors)
        .set({
          paymentStatus: "paid",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sponsors.id, sponsorId));
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const rsvpId = session.metadata?.rsvp_id;
    const sponsorId = session.metadata?.sponsor_id;

    if (rsvpId) {
      await db
        .update(rsvps)
        .set({
          paymentStatus: "failed",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(rsvps.id, rsvpId));
    }

    if (sponsorId) {
      await db
        .update(sponsors)
        .set({
          paymentStatus: "failed",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sponsors.id, sponsorId));
    }
  }

  return NextResponse.json({ received: true });
}
