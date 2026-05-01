import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { reunionId, registrationOpen } = await req.json();

  if (!reunionId || typeof registrationOpen !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const guard = await requireReunionAdmin(reunionId);
  if (guard instanceof NextResponse) return guard;

  await db
    .update(reunions)
    .set({
      registrationOpen,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(reunions.id, reunionId));

  return NextResponse.json({ ok: true });
}
