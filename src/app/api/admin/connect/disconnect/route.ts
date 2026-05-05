import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripeConnectAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

/**
 * Delete a connected Stripe Express account and remove the local
 * stripe_connect_accounts row.
 *
 * Stripe blocks platforms with loss liability from removing connected
 * accounts via the dashboard ("Consider using the Delete API to
 * remove this account instead"). This route hits the Delete API
 * directly. On success Stripe destroys the account; the connected
 * account holder will see the link broken if they try to access their
 * Stripe Express dashboard.
 *
 * Stripe rejects the delete if the account has live activity (recent
 * payouts, balance, etc.). The error message from Stripe is surfaced
 * verbatim so the admin knows why and can resolve it (e.g. drain the
 * balance or contact Stripe).
 *
 * Password gate: if STRIPE_DISCONNECT_PASSWORD is set in the
 * environment, the caller MUST supply a matching `password` in the
 * body. If the env var isn't set, no password is required. This
 * lets the operator decide per-deploy whether to gate disconnects —
 * typically set on production, leave unset on dev/staging.
 *
 * The DB row is only removed AFTER Stripe accepts the delete — if
 * Stripe says no, we leave the local mapping intact so the admin
 * isn't stranded with an orphaned account ID.
 */
export async function POST(req: NextRequest) {
  let body: { reunionId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reunionId = body.reunionId?.trim();
  if (!reunionId) {
    return NextResponse.json(
      { error: "Missing reunionId" },
      { status: 400 }
    );
  }

  const guard = await requireReunionAdmin(reunionId);
  if (guard instanceof NextResponse) return guard;

  const env = stripeEnvironment();

  // Password gate (when configured). Server-side check against the
  // STRIPE_DISCONNECT_PASSWORD env var. If not set, no password is
  // required and we proceed.
  const expectedPassword = process.env.STRIPE_DISCONNECT_PASSWORD;
  if (expectedPassword) {
    if (!body.password || body.password !== expectedPassword) {
      return NextResponse.json(
        { error: "Incorrect password. Disconnect aborted." },
        { status: 401 }
      );
    }
  }

  const row = await db
    .select({ id: stripeConnectAccounts.id, accountId: stripeConnectAccounts.accountId })
    .from(stripeConnectAccounts)
    .where(
      and(
        eq(stripeConnectAccounts.reunionId, reunionId),
        eq(stripeConnectAccounts.environment, env)
      )
    )
    .get();

  if (!row) {
    return NextResponse.json(
      { error: "No connected account found for this reunion." },
      { status: 404 }
    );
  }

  const stripe = getStripe();
  try {
    await stripe.accounts.del(row.accountId);
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Stripe rejected the delete request.";
    console.error("[connect/disconnect] Stripe delete failed", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await db
    .delete(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.id, row.id));

  return NextResponse.json({ ok: true });
}
