import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const VALID_MODES = ["tease", "pre_register", "open"] as const;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reunionId, mode } = await req.json();

  if (!reunionId || !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .update(reunions)
    .set({
      siteMode: mode,
      // Keep registrationOpen in sync for backward compat
      registrationOpen: mode === "open",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(reunions.id, reunionId));

  return NextResponse.json({ success: true });
}
