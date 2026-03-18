import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";

export async function GET() {
  try {
    const result = await db.select().from(reunions).limit(1);
    return NextResponse.json({
      status: "ok",
      dbConnected: true,
      reunionCount: result.length,
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: String(error),
        hasDbUrl: !!process.env.DATABASE_URL,
        dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 20),
      },
      { status: 500 }
    );
  }
}
