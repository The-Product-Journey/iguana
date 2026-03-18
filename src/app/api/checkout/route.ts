import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions, rsvps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
    } = body;

    // Validate required fields
    if (!reunionId || !firstName || !lastName || !email || !guestCount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get reunion
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
      paymentStatus: "pending",
      amountPaidCents: 0,
      donationCents: 0,
    });

    // Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${reunion.name} — Registration (${guestCount} ${guestCount === 1 ? "person" : "people"})`,
          },
          unit_amount: reunion.registrationFeeCents * guestCount,
        },
        quantity: 1,
      },
    ];

    if (donationCents && donationCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Cover processing fees — Thank you!" },
          unit_amount: donationCents,
        },
        quantity: 1,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${baseUrl}/${slug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${slug}/rsvp?cancelled=true`,
      customer_email: email,
      metadata: {
        rsvp_id: rsvpId,
        reunion_id: reunionId,
        donation_cents: String(donationCents || 0),
      },
    });

    // Store checkout session ID on RSVP
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
