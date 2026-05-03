import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, getBaseUrl, buildConnectReturnUrl } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const { reunionId, slug, returnPath } = await req.json();

    if (!reunionId || !slug) {
      return NextResponse.json(
        { error: "Missing reunionId or slug" },
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
      return NextResponse.json(
        { error: "Reunion not found" },
        { status: 404 }
      );
    }

    if (reunion.stripeConnectedAccountId) {
      return NextResponse.json(
        {
          error:
            "Account already created — use resume onboarding to continue setup.",
        },
        { status: 409 }
      );
    }

    const stripe = getStripe();

    const baseUrl = getBaseUrl(req);
    const isProduction = baseUrl.startsWith("https://");

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      ...(isProduction && {
        business_profile: {
          url: `${baseUrl}/${reunion.slug}`,
        },
      }),
    });

    await db
      .update(reunions)
      .set({
        stripeConnectedAccountId: account.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(reunions.id, reunionId));

    const fallbackPath = `/admin/${reunion.slug}`;
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: buildConnectReturnUrl(req, returnPath, fallbackPath, "refresh"),
      return_url: buildConnectReturnUrl(req, returnPath, fallbackPath, "complete"),
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: unknown) {
    console.error("Connect account creation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create connected account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
