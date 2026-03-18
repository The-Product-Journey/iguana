import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const adminAuth = cookieStore.get("admin_auth")?.value;
  if (adminAuth !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reunionId, registrationOpen } = await req.json();

  if (!reunionId || typeof registrationOpen !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .update(reunions)
    .set({
      registrationOpen,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(reunions.id, reunionId));

  return NextResponse.json({ ok: true });
}
