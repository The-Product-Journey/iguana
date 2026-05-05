import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions, stripeConnectAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getStripe,
  getBaseUrl,
  buildConnectReturnUrl,
  stripeEnvironment,
} from "@/lib/stripe";
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

    const env = stripeEnvironment();

    const existing = await db
      .select({ accountId: stripeConnectAccounts.accountId })
      .from(stripeConnectAccounts)
      .where(
        and(
          eq(stripeConnectAccounts.reunionId, reunionId),
          eq(stripeConnectAccounts.environment, env)
        )
      )
      .get();

    if (existing) {
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
      // Pre-fill the connected account's email with the admin who's
      // initiating onboarding. Stripe surfaces this in the Express
      // onboarding flow so the organizer doesn't have to type it.
      // They can change it on the next screen if their Stripe contact
      // email differs from their admin login.
      email: guard.email,
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

    await db.insert(stripeConnectAccounts).values({
      reunionId,
      environment: env,
      accountId: account.id,
    });

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
