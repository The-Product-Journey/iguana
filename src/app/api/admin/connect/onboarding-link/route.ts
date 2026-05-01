import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, getBaseUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reunionId, slug } = await req.json();

    if (!reunionId || !slug) {
      return NextResponse.json(
        { error: "Missing reunionId or slug" },
        { status: 400 }
      );
    }

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

    if (!reunion.stripeConnectedAccountId) {
      return NextResponse.json(
        { error: "No connected account — set up payouts first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = getBaseUrl(req);

    const accountLink = await stripe.accountLinks.create({
      account: reunion.stripeConnectedAccountId,
      refresh_url: `${baseUrl}/admin/${reunion.slug}?connect=refresh`,
      return_url: `${baseUrl}/admin/${reunion.slug}?connect=complete`,
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
