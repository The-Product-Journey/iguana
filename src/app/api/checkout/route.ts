import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions, rsvps, events, registrationEvents } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getStripe, Stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reunionId,
      slug,
      firstName,
      lastName,
      email,
      phone,
      guestCount,
      dietaryNotes,
      message,
      donationCents,
      eventIds,
    } = body;

    if (!reunionId || !firstName || !lastName || !email || !guestCount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify site mode is open
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.id, reunionId))
      .get();

    if (!reunion || !reunion.isActive) {
      return NextResponse.json(
        { error: "Reunion not found or inactive" },
        { status: 404 }
      );
    }

    if (reunion.siteMode !== "open") {
      return NextResponse.json(
        { error: "Registration is not open yet" },
        { status: 403 }
      );
    }

    // Validate Stripe Connect is configured before creating any records
    if (!reunion.stripeConnectedAccountId || !reunion.stripeConnectChargesEnabled) {
      return NextResponse.json(
        { error: "Payouts not configured — organizer needs to complete Stripe setup" },
        { status: 400 }
      );
    }

    // Validate eventIds
    let reunionEvents: { id: string; type: string; priceCents: number | null; earlyPriceCents: number | null; earlyPriceDeadline: string | null }[] = [];
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      reunionEvents = await db
        .select({
          id: events.id,
          type: events.type,
          priceCents: events.priceCents,
          earlyPriceCents: events.earlyPriceCents,
          earlyPriceDeadline: events.earlyPriceDeadline,
        })
        .from(events)
        .where(
          and(eq(events.reunionId, reunionId), inArray(events.id, eventIds))
        );

      if (reunionEvents.length !== eventIds.length) {
        return NextResponse.json(
          { error: "One or more invalid event selections" },
          { status: 400 }
        );
      }
    }

    // Calculate price from paid events
    const now = new Date();
    let totalCents = 0;
    for (const event of reunionEvents) {
      if (event.type === "paid" && event.priceCents) {
        const isEarlyBird =
          event.earlyPriceDeadline &&
          event.earlyPriceCents &&
          now < new Date(event.earlyPriceDeadline);
        const unitPrice = isEarlyBird
          ? event.earlyPriceCents!
          : event.priceCents;
        totalCents += unitPrice * guestCount;
      }
    }

    const editToken = crypto.randomUUID();

    // Create RSVP (pending payment)
    const rsvpId = crypto.randomUUID();
    await db.insert(rsvps).values({
      id: rsvpId,
      reunionId,
      firstName,
      lastName,
      email,
      phone: phone || null,
      guestCount,
      dietaryNotes: dietaryNotes || null,
      message: message || null,
      editToken,
      paymentMethod: "online",
      paymentStatus: "pending",
      amountPaidCents: 0,
      donationCents: 0,
    });

    // Insert event selections
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      await db.insert(registrationEvents).values(
        eventIds.map((eventId: string) => ({
          rsvpId,
          eventId,
        }))
      );
    }

    // Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (totalCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${reunion.name} — Registration (${guestCount} ${guestCount === 1 ? "person" : "people"})`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      });
    }

    const safeDonation = donationCents && donationCents > 0 ? donationCents : 0;
    if (safeDonation > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Cover processing fees — Thank you!" },
          unit_amount: safeDonation,
        },
        quantity: 1,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_intent_data: {
        transfer_data: {
          destination: reunion.stripeConnectedAccountId!,
        },
        on_behalf_of: reunion.stripeConnectedAccountId!,
      },
      success_url: `${baseUrl}/${reunion.slug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${reunion.slug}/rsvp?cancelled=true`,
      customer_email: email,
      metadata: {
        rsvp_id: rsvpId,
        reunion_id: reunionId,
        donation_cents: String(safeDonation),
        edit_token: editToken,
      },
    });

    // Store checkout session ID
    await db
      .update(rsvps)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(rsvps.id, rsvpId));

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
