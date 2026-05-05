import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripeConnectAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * Super-admin-only "force delete" of a stripe_connect_accounts row.
 *
 * Difference from /api/admin/connect/disconnect:
 *   - This NEVER calls stripe.accounts.del(). It only clears the
 *     local DB mapping. Use it when the Stripe-side account is in a
 *     state that prevents the regular delete (active disputes, owed
 *     funds, deletions stuck in limbo) and you've already given up on
 *     getting Stripe to drop it cleanly.
 *   - The Stripe-side account is left intact. Whoever has the Stripe
 *     dashboard for the platform must clean it up there manually if
 *     they want it fully gone.
 *
 * Same password gate as the regular disconnect: when
 * STRIPE_DISCONNECT_PASSWORD is set in the environment, body.password
 * must match. Force delete is the more destructive of the two so we
 * always honor the gate.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const expectedPassword = process.env.STRIPE_DISCONNECT_PASSWORD;
  if (expectedPassword) {
    if (!body.password || body.password !== expectedPassword) {
      return NextResponse.json(
        { error: "Incorrect password. Force delete aborted." },
        { status: 401 }
      );
    }
  }

  const row = await db
    .select({ id: stripeConnectAccounts.id })
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  await db
    .delete(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.id, id));

  return NextResponse.json({ ok: true });
}
