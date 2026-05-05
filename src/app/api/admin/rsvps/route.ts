import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rsvps } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { requireReunionAdmin } from "@/lib/admin-auth";

/**
 * Admin actions on rsvps. Mirrors /api/admin/sponsors:
 *
 *   action: "refreshFromStripe"  — single row by rsvpId. Pulls the
 *   Checkout Session from Stripe and reconciles paymentStatus +
 *   stripePaymentIntentId.
 *
 *   action: "refreshAllPending"  — all pending rows for the given
 *   reunionId that have a stripeCheckoutSessionId. Iterates through
 *   them serially (small reunions, simpler rate-limit story) and
 *   reports a per-row outcome. Useful when webhooks aren't wired
 *   and you need to reconcile a batch in one click.
 */
type RefreshOne = { action: "refreshFromStripe"; rsvpId: string };
type RefreshBatch = { action: "refreshAllPending"; reunionId: string };
type Body = RefreshOne | RefreshBatch;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "refreshFromStripe") {
    const row = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.id, body.rsvpId))
      .get();
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const guard = await requireReunionAdmin(row.reunionId);
    if (guard instanceof NextResponse) return guard;

    if (!row.stripeCheckoutSessionId) {
      return NextResponse.json(
        {
          error:
            "This RSVP has no Stripe Checkout session — likely a door-payment row or pre-payment-flow data. Nothing to sync.",
        },
        { status: 400 }
      );
    }

    const result = await reconcileOne(row.id, row.stripeCheckoutSessionId);
    return NextResponse.json(result);
  }

  if (body.action === "refreshAllPending") {
    const guard = await requireReunionAdmin(body.reunionId);
    if (guard instanceof NextResponse) return guard;

    const pending = await db
      .select({
        id: rsvps.id,
        stripeCheckoutSessionId: rsvps.stripeCheckoutSessionId,
      })
      .from(rsvps)
      .where(
        and(
          eq(rsvps.reunionId, body.reunionId),
          eq(rsvps.paymentStatus, "pending"),
          isNotNull(rsvps.stripeCheckoutSessionId)
        )
      )
      .all();

    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    for (const r of pending) {
      if (!r.stripeCheckoutSessionId) continue;
      try {
        const result = await reconcileOne(r.id, r.stripeCheckoutSessionId);
        if (result.changed) updated++;
        else unchanged++;
      } catch (err) {
        failed++;
        console.error(
          "[admin/rsvps] refreshAllPending row failed",
          r.id,
          err
        );
      }
    }

    return NextResponse.json({
      success: true,
      total: pending.length,
      updated,
      unchanged,
      failed,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/**
 * Pull a Checkout Session and write any newly-resolved state back to
 * the rsvps row. Updates paymentStatus, amountPaidCents, donationCents
 * (if newly paid), and stripePaymentIntentId. Returns a small report
 * the caller can surface.
 */
async function reconcileOne(rsvpId: string, sessionId: string): Promise<{
  success: true;
  changed: boolean;
  paymentStatus: string;
  sessionStatus: string | null;
}> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Re-read current row so we have the existing values to compare.
  const current = await db
    .select()
    .from(rsvps)
    .where(eq(rsvps.id, rsvpId))
    .get();
  if (!current) throw new Error("Row disappeared mid-reconcile");

  let nextStatus: "pending" | "paid" | "failed" | "refunded" =
    current.paymentStatus;
  if (
    session.status === "complete" &&
    (session.payment_status === "paid" ||
      session.payment_status === "no_payment_required")
  ) {
    nextStatus = "paid";
  } else if (session.status === "expired") {
    nextStatus = "failed";
  } else if (session.status === "open") {
    nextStatus = "pending";
  }

  const piId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const updates: Partial<typeof rsvps.$inferInsert> = {};
  if (nextStatus !== current.paymentStatus) {
    updates.paymentStatus = nextStatus;
  }
  if (
    nextStatus === "paid" &&
    (current.amountPaidCents ?? 0) === 0 &&
    session.amount_total
  ) {
    updates.amountPaidCents = session.amount_total;
  }
  if (piId && current.stripePaymentIntentId !== piId) {
    updates.stripePaymentIntentId = piId;
  }

  const changed = Object.keys(updates).length > 0;
  if (changed) {
    updates.updatedAt = new Date().toISOString();
    await db.update(rsvps).set(updates).where(eq(rsvps.id, rsvpId));
  }

  return {
    success: true,
    changed,
    paymentStatus: nextStatus,
    sessionStatus: session.status ?? null,
  };
}
