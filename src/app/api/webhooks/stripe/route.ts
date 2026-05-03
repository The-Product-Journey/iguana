import { NextRequest, NextResponse } from "next/server";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { db } from "@/lib/db";
import { rsvps, sponsors, stripeConnectAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
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

  if (event.type === "account.updated") {
    const accountId = (event.data.object as { id: string }).id;

    // Treat webhook as a hint — retrieve live account state
    let account;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (err) {
      console.error("Failed to retrieve connected account:", err);
      return NextResponse.json(
        { error: "Failed to retrieve account" },
        { status: 500 }
      );
    }

    // Update the cached row for this accountId in the current environment.
    // We scope by environment to avoid a stray webhook from one env touching
    // a row in the other (defensive — the same accountId can't actually
    // exist in both, but guards against test/live key crosstalk).
    await db
      .update(stripeConnectAccounts)
      .set({
        detailsSubmitted: account.details_submitted ?? false,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(stripeConnectAccounts.accountId, accountId),
          eq(stripeConnectAccounts.environment, stripeEnvironment())
        )
      );
  }

  return NextResponse.json({ received: true });
}
