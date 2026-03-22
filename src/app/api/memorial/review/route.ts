import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memorials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { reviewToken, action, notes } = await req.json();

    if (!reviewToken || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const memorial = await db
      .select()
      .from(memorials)
      .where(eq(memorials.reviewToken, reviewToken))
      .get();

    if (!memorial) {
      return NextResponse.json(
        { error: "Memorial not found" },
        { status: 404 }
      );
    }

    if (memorial.status !== "pending_review") {
      return NextResponse.json(
        { error: "Memorial is not pending review" },
        { status: 400 }
      );
    }

    if (action === "approved") {
      await db
        .update(memorials)
        .set({
          status: "published",
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(memorials.id, memorial.id));
    } else if (action === "changes") {
      await db
        .update(memorials)
        .set({
          status: "draft",
          reviewNotes: notes || null,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(memorials.id, memorial.id));
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Memorial review error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
