import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sponsorId, action } = await req.json();

  if (!sponsorId || !action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (action === "toggleDisplay") {
    const sponsor = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.id, sponsorId))
      .get();

    if (!sponsor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(sponsors)
      .set({
        isDisplayed: !sponsor.isDisplayed,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sponsors.id, sponsorId));
  }

  return NextResponse.json({ success: true });
}
