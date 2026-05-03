import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uploadImage } from "@/lib/upload";

/**
 * Update a sponsor's public-display preferences after they've completed
 * payment. Looked up by Stripe Checkout session_id (passed as URL param
 * on the confirmation page after Stripe redirects back).
 *
 * Accepts multipart/form-data so we can include an optional logo file.
 * Auth model: anyone holding the session_id can update. Session IDs are
 * long random strings only known to the customer who completed checkout.
 *
 * Form fields:
 *  - sessionId (required)
 *  - displayName, message, websiteUrl (optional strings; empty = clear)
 *  - isAnonymous (optional "true"/"false" string)
 *  - logoFile (optional File)
 *  - removeLogo ("true" string, optional — clears the existing logoUrl)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionId = formData.get("sessionId");

    if (typeof sessionId !== "string" || !sessionId) {
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
      logoUrl?: string | null;
      updatedAt: string;
    } = { updatedAt: new Date().toISOString() };

    function strField(key: string): string | null | undefined {
      if (!formData.has(key)) return undefined;
      const v = formData.get(key);
      if (typeof v !== "string") return null;
      return v.trim() || null;
    }

    const displayName = strField("displayName");
    if (displayName !== undefined) updates.displayName = displayName;

    const message = strField("message");
    if (message !== undefined) updates.message = message;

    const websiteUrl = strField("websiteUrl");
    if (websiteUrl !== undefined) updates.websiteUrl = websiteUrl;

    if (formData.has("isAnonymous")) {
      const v = formData.get("isAnonymous");
      updates.isAnonymous = v === "true" || v === "on" || v === "1";
    }

    // Logo: explicit remove takes precedence; otherwise upload if a file was
    // provided. Files coming through FormData with no selection have size 0.
    const removeLogo = formData.get("removeLogo") === "true";
    if (removeLogo) {
      updates.logoUrl = null;
    } else {
      const logoFile = formData.get("logoFile");
      if (logoFile instanceof File && logoFile.size > 0) {
        try {
          updates.logoUrl = await uploadImage(logoFile, "sponsors");
        } catch (e) {
          const message = e instanceof Error ? e.message : "Upload failed";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
    }

    await db
      .update(sponsors)
      .set(updates)
      .where(eq(sponsors.id, sponsor.id));

    return NextResponse.json({ success: true, logoUrl: updates.logoUrl });
  } catch (error) {
    console.error("[sponsor/recognition] error", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
