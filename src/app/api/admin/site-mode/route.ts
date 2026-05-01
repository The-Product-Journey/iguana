import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireReunionAdmin } from "@/lib/admin-auth";

const VALID_MODES = ["tease", "pre_register", "open"] as const;

export async function POST(req: NextRequest) {
  const { reunionId, mode } = await req.json();

  if (!reunionId || !VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const guard = await requireReunionAdmin(reunionId);
  if (guard instanceof NextResponse) return guard;

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
