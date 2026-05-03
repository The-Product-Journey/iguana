import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, buildConnectReturnUrl, loadConnectAccount } from "@/lib/stripe";
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

    const connect = await loadConnectAccount(reunionId);
    if (!connect) {
      return NextResponse.json(
        { error: "No connected account — set up payouts first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const fallbackPath = `/admin/${reunion.slug}`;

    const accountLink = await stripe.accountLinks.create({
      account: connect.accountId,
      refresh_url: buildConnectReturnUrl(req, returnPath, fallbackPath, "refresh"),
      return_url: buildConnectReturnUrl(req, returnPath, fallbackPath, "complete"),
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Onboarding link error:", error);
    return NextResponse.json(
      { error: "Failed to generate onboarding link" },
      { status: 500 }
    );
  }
}
