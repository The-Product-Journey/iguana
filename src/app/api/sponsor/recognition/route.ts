import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Update a sponsor's public-display preferences after they've completed
 * payment. Looked up by Stripe Checkout session_id (passed as URL param
 * on the confirmation page after Stripe redirects back).
 *
 * Updatable fields:
 *  - displayName: override for the public name (defaults to company || contact)
 *  - isAnonymous: shows "Anonymous Sponsor" and hides website/logo
 *  - message: tagline/comment shown under the name
 *  - websiteUrl: link from the name
 *
 * Auth model: anyone holding the session_id can update. Session IDs are
 * long random strings only known to the customer who completed checkout
 * (and the platform), so this is functionally equivalent to an edit token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      displayName,
      isAnonymous,
      message,
      websiteUrl,
    }: {
      sessionId?: string;
      displayName?: string | null;
      isAnonymous?: boolean;
      message?: string | null;
      websiteUrl?: string | null;
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const sponsor = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.stripeCheckoutSessionId, sessionId))
      .get();

    if (!sponsor) {
      return NextResponse.json(
        { error: "Sponsor not found for this session." },
        { status: 404 }
      );
    }

    const updates: {
      displayName?: string | null;
      isAnonymous?: boolean;
      message?: string | null;
      websiteUrl?: string | null;
      updatedAt: string;
    } = { updatedAt: new Date().toISOString() };

    if (displayName !== undefined) {
      updates.displayName = displayName?.trim() || null;
    }
    if (isAnonymous !== undefined) {
      updates.isAnonymous = !!isAnonymous;
    }
    if (message !== undefined) {
      updates.message = message?.trim() || null;
    }
    if (websiteUrl !== undefined) {
      updates.websiteUrl = websiteUrl?.trim() || null;
    }

    await db
      .update(sponsors)
      .set(updates)
      .where(eq(sponsors.id, sponsor.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sponsor/recognition] error", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
