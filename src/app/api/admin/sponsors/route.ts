import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sponsorId, action } = await req.json();

  if (!sponsorId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "toggleDisplay") {
    const sponsor = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.id, sponsorId))
      .get();

    if (!sponsor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(sponsors)
      .set({
        isDisplayed: !sponsor.isDisplayed,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sponsors.id, sponsorId));

    return NextResponse.json({ success: true });
  }

  if (action === "refreshFromStripe") {
    const sponsor = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.id, sponsorId))
      .get();

    if (!sponsor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!sponsor.stripeCheckoutSessionId) {
      return NextResponse.json(
        {
          error:
            "This sponsor has no Stripe Checkout session — likely created before payment was set up. Cannot sync.",
        },
        { status: 400 }
      );
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        sponsor.stripeCheckoutSessionId
      );

      // Map Stripe session state to our paymentStatus enum.
      // session.status: "open" | "complete" | "expired"
      // session.payment_status: "paid" | "unpaid" | "no_payment_required"
      let nextStatus: "pending" | "paid" | "failed" = sponsor.paymentStatus;
      if (
        session.status === "complete" &&
        (session.payment_status === "paid" ||
          session.payment_status === "no_payment_required")
      ) {
        nextStatus = "paid";
      } else if (session.status === "expired") {
        nextStatus = "failed";
      } else if (session.status === "open") {
        nextStatus = "pending";
      }

      console.log("[admin/sponsors] refreshFromStripe", {
        sponsorId,
        sessionId: sponsor.stripeCheckoutSessionId,
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
        previousDbStatus: sponsor.paymentStatus,
        nextDbStatus: nextStatus,
      });

      if (nextStatus !== sponsor.paymentStatus) {
        await db
          .update(sponsors)
          .set({
            paymentStatus: nextStatus,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sponsors.id, sponsorId));
      }

      return NextResponse.json({
        success: true,
        paymentStatus: nextStatus,
        sessionStatus: session.status,
      });
    } catch (error) {
      console.error("[admin/sponsors] Stripe refresh failed", error);
      const message =
        error instanceof Error ? error.message : "Stripe API error";
      return NextResponse.json(
        { error: `Failed to sync from Stripe: ${message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
