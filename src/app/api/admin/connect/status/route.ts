import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  // Note: connect/status reads reunionId from QUERY STRING, not body.
  const reunionId = req.nextUrl.searchParams.get("reunionId");
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
    console.log("[connect/status] No connected account on reunion", {
      reunionId,
      slug: reunion.slug,
    });
    return NextResponse.json({ status: null });
  }

  try {
    const stripe = getStripe();
    console.log("[connect/status] Querying Stripe for account", {
      reunionId,
      slug: reunion.slug,
      connectedAccountId: reunion.stripeConnectedAccountId,
    });
    const account = await stripe.accounts.retrieve(
      reunion.stripeConnectedAccountId
    );

    const detailsSubmitted = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    console.log("[connect/status] Stripe response", {
      connectedAccountId: account.id,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
      requirements_currently_due:
        account.requirements?.currently_due ?? [],
      requirements_disabled_reason:
        account.requirements?.disabled_reason ?? null,
      capabilities: account.capabilities ?? null,
    });

    const dbBefore = {
      onboardingComplete: !!reunion.stripeConnectOnboardingComplete,
      chargesEnabled: !!reunion.stripeConnectChargesEnabled,
      payoutsEnabled: !!reunion.stripeConnectPayoutsEnabled,
    };

    // Write-through: update DB if status has changed
    const changed =
      detailsSubmitted !== dbBefore.onboardingComplete ||
      chargesEnabled !== dbBefore.chargesEnabled ||
      payoutsEnabled !== dbBefore.payoutsEnabled;

    if (changed) {
      await db
        .update(reunions)
        .set({
          stripeConnectOnboardingComplete: detailsSubmitted,
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectPayoutsEnabled: payoutsEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(reunions.id, reunionId));
      console.log("[connect/status] DB updated", {
        before: dbBefore,
        after: { detailsSubmitted, chargesEnabled, payoutsEnabled },
      });
    } else {
      console.log("[connect/status] DB already in sync — no write", dbBefore);
    }

    return NextResponse.json({
      status: { detailsSubmitted, chargesEnabled, payoutsEnabled },
    });
  } catch (error) {
    console.error("[connect/status] Stripe API error:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve account status",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
