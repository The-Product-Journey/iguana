import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reunionId = req.nextUrl.searchParams.get("reunionId");
  if (!reunionId) {
    return NextResponse.json(
      { error: "Missing reunionId" },
      { status: 400 }
    );
  }

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();

  if (!reunion) {
    return NextResponse.json({ error: "Reunion not found" }, { status: 404 });
  }

  if (!reunion.stripeConnectedAccountId) {
    return NextResponse.json({ status: null });
  }

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(
      reunion.stripeConnectedAccountId
    );

    const detailsSubmitted = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    // Write-through: update DB if status has changed
    if (
      detailsSubmitted !== !!reunion.stripeConnectOnboardingComplete ||
      chargesEnabled !== !!reunion.stripeConnectChargesEnabled ||
      payoutsEnabled !== !!reunion.stripeConnectPayoutsEnabled
    ) {
      await db
        .update(reunions)
        .set({
          stripeConnectOnboardingComplete: detailsSubmitted,
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectPayoutsEnabled: payoutsEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(reunions.id, reunionId));
    }

    return NextResponse.json({
      status: { detailsSubmitted, chargesEnabled, payoutsEnabled },
    });
  } catch (error) {
    console.error("Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve account status" },
      { status: 500 }
    );
  }
}
