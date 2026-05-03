import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reunions, sponsors } from "@/lib/db/schema";
import { getStripe, getBaseUrl, loadConnectAccount } from "@/lib/stripe";
import { getSponsorTier, computeApplicationFeeCents } from "@/lib/constants";
import { uploadImage } from "@/lib/upload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const reunionId = formData.get("reunionId") as string;
    const slug = formData.get("slug") as string;
    const contactName = formData.get("contactName") as string;
    const contactEmail = formData.get("contactEmail") as string;
    const contactPhone = (formData.get("contactPhone") as string) || null;
    const companyName = (formData.get("companyName") as string) || null;
    const websiteUrl = (formData.get("websiteUrl") as string) || null;
    const amountCents = parseInt(formData.get("amountCents") as string, 10);
    const message = (formData.get("message") as string) || null;
    const logoFile = formData.get("logo") as File | null;

    if (!reunionId || !contactName || !contactEmail || !amountCents) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amountCents < 1000) {
      return NextResponse.json(
        { error: "Minimum sponsorship is $10.00" },
        { status: 400 }
      );
    }

    // Validate Stripe Connect is configured before creating any records
    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.id, reunionId))
      .get();

    if (!reunion) {
      return NextResponse.json(
        { error: "Reunion not found" },
        { status: 404 }
      );
    }

    const connect = await loadConnectAccount(reunionId);
    if (!connect || !connect.chargesEnabled) {
      return NextResponse.json(
        { error: "Payouts not configured — organizer needs to complete Stripe setup" },
        { status: 400 }
      );
    }

    const tier = getSponsorTier(amountCents);

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile && logoFile.size > 0) {
      logoUrl = await uploadImage(logoFile, "sponsors");
    }

    // Create sponsor record
    const [sponsor] = await db
      .insert(sponsors)
      .values({
        reunionId,
        contactName,
        contactEmail,
        contactPhone,
        companyName,
        logoUrl,
        websiteUrl,
        amountCents,
        tier,
        message,
        paymentStatus: "pending",
      })
      .returning();

    // Create Stripe checkout session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier === "top" ? "Trojan" : "Community Service Project"} Sponsorship${companyName ? ` — ${companyName}` : ""}`,
              description: `PHHS Class of 1996 Reunion Sponsorship`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: {
          destination: connect.accountId,
        },
        on_behalf_of: connect.accountId,
        // application_fee_amount = platform's intended cut + estimated
        // Stripe processing fee. Stripe debits the actual processing fee
        // from the platform balance, so this gross amount lets us recoup
        // the Stripe fee and keep our net platform fee. Connected account
        // ends up with (amountCents - application_fee_amount).
        application_fee_amount: computeApplicationFeeCents(amountCents),
      },
      mode: "payment",
      success_url: `${getBaseUrl(req)}/${reunion.slug}/sponsor/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl(req)}/${reunion.slug}/sponsor`,
      customer_email: contactEmail,
      metadata: {
        sponsor_id: sponsor.id,
        reunion_id: reunionId,
      },
    });

    // Store the checkout session ID
    await db
      .update(sponsors)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sponsors.id, sponsor.id));

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Sponsor checkout error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
