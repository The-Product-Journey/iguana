import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripeConnectAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getStripe, stripeEnvironment } from "@/lib/stripe";

/**
 * Super-admin-only "force delete" of a stripe_connect_accounts row.
 *
 * Two-step protocol so we never silently strand a Stripe-side account
 * when the operator only meant to retry a normal delete:
 *
 *   - attempt: "stripe-then-db" (default)
 *       Try stripe.accounts.del(). On success, also clear the local
 *       row. On Stripe failure, leave the local row in place and
 *       return 400 with the Stripe error + canForceDbOnly: true so
 *       the UI can offer an explicit second-step confirmation.
 *
 *   - attempt: "db-only"
 *       Skip Stripe entirely and just clear the local row. This is
 *       the explicit override path — used when (a) Stripe rejected
 *       the regular attempt and the operator chose to detach
 *       locally anyway, or (b) the row is for the opposite Stripe
 *       env from what this deploy is keyed for, so we couldn't
 *       authenticate against Stripe anyway.
 *
 * Same password gate as /api/admin/connect/disconnect: when
 * STRIPE_DISCONNECT_PASSWORD is set, body.password must match. Both
 * attempt modes go through the gate.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: {
    id?: string;
    password?: string;
    attempt?: "stripe-then-db" | "db-only";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const attempt = body.attempt === "db-only" ? "db-only" : "stripe-then-db";

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
    .select({
      id: stripeConnectAccounts.id,
      accountId: stripeConnectAccounts.accountId,
      environment: stripeConnectAccounts.environment,
    })
    .from(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  if (attempt === "stripe-then-db") {
    const currentEnv = stripeEnvironment();
    if (row.environment !== currentEnv) {
      // Wrong-env keys; we'd authenticate as the other Stripe account
      // and Stripe would reject the delete. Surface a clear "use
      // db-only" upgrade path instead of pretending to try.
      return NextResponse.json(
        {
          error: `Can't delete on Stripe — this deploy is on ${currentEnv} keys but the row is in ${row.environment} env. Re-run with attempt="db-only" to clear the local row.`,
          canForceDbOnly: true,
        },
        { status: 400 }
      );
    }

    try {
      await getStripe().accounts.del(row.accountId);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Stripe rejected the delete.";
      console.error("[force-delete] Stripe del rejected", err);
      return NextResponse.json(
        { error: msg, canForceDbOnly: true },
        { status: 400 }
      );
    }
  }

  // Either Stripe accepted the delete OR the operator explicitly
  // requested db-only after a Stripe rejection (or for a cross-env
  // row). Clear the local row.
  await db
    .delete(stripeConnectAccounts)
    .where(eq(stripeConnectAccounts.id, id));

  return NextResponse.json({ ok: true });
}
