import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

/**
 * Mint a short-lived (~5 min) auto-login URL for the reunion's connected
 * Stripe Express account. The organizer/admin clicks "Open Stripe Dashboard"
 * in our admin panel, we generate the link, redirect them there. No Stripe
 * credentials required — Stripe's Express Dashboard is already authorized.
 *
 * Stripe constraint: login links only work once `details_submitted=true`
 * on the connected account. Calling this on an incomplete account 400s
 * from Stripe, which we surface as a clear error.
 */
export async function POST(req: NextRequest) {
  try {
    const { reunionId } = await req.json();

    if (!reunionId) {
      return NextResponse.json(
        { error: "Missing reunionId" },
        { status: 400 }
      );
    }

    const guard = await requireReunionAdmin(reunionId);
    if (guard instanceof NextResponse) return guard;

    const reunion = await db
      .select()
      .from(reunions)
      .where(eq(reunions.id, reunionId))
      .get();

    if (!reunion) {
      return NextResponse.json({ error: "Reunion not found" }, { status: 404 });
    }

    if (!reunion.stripeConnectedAccountId) {
      return NextResponse.json(
        { error: "No connected account on this reunion." },
        { status: 400 }
      );
    }

    if (!reunion.stripeConnectOnboardingComplete) {
      return NextResponse.json(
        {
          error:
            "Stripe onboarding isn't complete yet. Finish onboarding before opening the Stripe dashboard.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const link = await stripe.accounts.createLoginLink(
      reunion.stripeConnectedAccountId
    );

    console.log("[connect/login-link] Issued login link", {
      reunionId,
      slug: reunion.slug,
      connectedAccountId: reunion.stripeConnectedAccountId,
    });

    return NextResponse.json({ url: link.url });
  } catch (error: unknown) {
    console.error("[connect/login-link] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate login link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
