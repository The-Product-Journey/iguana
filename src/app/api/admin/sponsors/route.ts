import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sponsorId, action } = body;

  if (!sponsorId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Resolve reunionId from the sponsor row. sponsors.reunionId is a direct
  // column — no join needed.
  const sponsor = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .get();

  if (!sponsor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const guard = await requireReunionAdmin(sponsor.reunionId);
  if (guard instanceof NextResponse) return guard;

  if (action === "toggleDisplay") {
    await db
      .update(sponsors)
      .set({
        isDisplayed: !sponsor.isDisplayed,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sponsors.id, sponsorId));

    return NextResponse.json({ success: true });
  }

  if (action === "publishWithEdits") {
    // Save the admin's recognition edits and flip isDisplayed=true atomically.
    const updates: {
      displayName: string | null;
      isAnonymous: boolean;
      message: string | null;
      websiteUrl: string | null;
      logoUrl?: string | null;
      isDisplayed: boolean;
      updatedAt: string;
    } = {
      displayName: strOrNull(body.displayName),
      isAnonymous: !!body.isAnonymous,
      message: strOrNull(body.message),
      websiteUrl: strOrNull(body.websiteUrl),
      isDisplayed: true,
      updatedAt: new Date().toISOString(),
    };
    if (body.removeLogo === true) {
      updates.logoUrl = null;
    }
    await db.update(sponsors).set(updates).where(eq(sponsors.id, sponsorId));

    return NextResponse.json({ success: true });
  }

  if (action === "refreshFromStripe") {
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
