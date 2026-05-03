import { NextRequest, NextResponse } from "next/server";
import { refreshConnectAccount } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  // Note: connect/status reads reunionId from QUERY STRING, not body.
  const reunionId = req.nextUrl.searchParams.get("reunionId");
  if (!reunionId) {
    return NextResponse.json(
      { error: "Missing reunionId" },
      { status: 400 }
    );
  }

  const guard = await requireReunionAdmin(reunionId);
  if (guard instanceof NextResponse) return guard;

  const connect = await refreshConnectAccount(reunionId);
  if (!connect) {
    console.log("[connect/status] No connected account for current env", {
      reunionId,
    });
    return NextResponse.json({ status: null });
  }

  return NextResponse.json({
    status: {
      detailsSubmitted: connect.detailsSubmitted,
      chargesEnabled: connect.chargesEnabled,
      payoutsEnabled: connect.payoutsEnabled,
    },
  });
}
