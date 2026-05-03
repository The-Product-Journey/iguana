import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stripeConnectAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export type StripeEnvironment = "test" | "live";

/**
 * Which Stripe environment is the running process pointed at?
 *
 * Inferred from the secret key prefix — Stripe keys are `sk_live_...` in
 * live mode and `sk_test_...` in test mode. This lets the same Turso DB
 * back both staging (test) and production (live) deploys without their
 * Connect account IDs colliding.
 */
export function stripeEnvironment(): StripeEnvironment {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";
}

export type ConnectAccount = {
  accountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

/**
 * Read a reunion's Stripe Connect account for the current environment from
 * the DB cache. Returns null when no row exists in `stripe_connect_accounts`
 * — meaning the organizer hasn't onboarded payouts in this environment yet.
 *
 * Cached values are kept fresh by:
 *   - the `account.updated` webhook (src/app/api/webhooks/stripe/route.ts)
 *   - the `/api/admin/connect/status` endpoint (admin pull-to-refresh)
 *
 * This is the cheap, no-Stripe-call read used by public sponsor / RSVP
 * pages to gate the payment UI. Admin operations that need live ground
 * truth (login link, post-onboarding capability check) call
 * `refreshConnectAccount()` instead.
 */
export async function loadConnectAccount(
  reunionId: string
): Promise<ConnectAccount | null> {
  const env = stripeEnvironment();
  const row = await db
    .select()
    .from(stripeConnectAccounts)
    .where(
      and(
        eq(stripeConnectAccounts.reunionId, reunionId),
        eq(stripeConnectAccounts.environment, env)
      )
    )
    .get();
  if (!row) return null;
  return {
    accountId: row.accountId,
    detailsSubmitted: row.detailsSubmitted,
    chargesEnabled: row.chargesEnabled,
    payoutsEnabled: row.payoutsEnabled,
  };
}

/**
 * Pull the latest status from Stripe for this reunion's connected account
 * (current environment), update the DB cache, and return the fresh values.
 *
 * Returns null if no row exists for the reunion in this environment.
 * On Stripe API failure, returns the existing cached row unchanged — we
 * never erase known-good cached state because of a transient API error.
 */
export async function refreshConnectAccount(
  reunionId: string
): Promise<ConnectAccount | null> {
  const env = stripeEnvironment();
  const row = await db
    .select()
    .from(stripeConnectAccounts)
    .where(
      and(
        eq(stripeConnectAccounts.reunionId, reunionId),
        eq(stripeConnectAccounts.environment, env)
      )
    )
    .get();
  if (!row) return null;

  try {
    const account = await getStripe().accounts.retrieve(row.accountId);
    const detailsSubmitted = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    const changed =
      detailsSubmitted !== row.detailsSubmitted ||
      chargesEnabled !== row.chargesEnabled ||
      payoutsEnabled !== row.payoutsEnabled;

    if (changed) {
      await db
        .update(stripeConnectAccounts)
        .set({
          detailsSubmitted,
          chargesEnabled,
          payoutsEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stripeConnectAccounts.id, row.id));
    }

    return {
      accountId: row.accountId,
      detailsSubmitted,
      chargesEnabled,
      payoutsEnabled,
    };
  } catch (err) {
    console.error("[stripe] refreshConnectAccount retrieve failed", {
      reunionId,
      accountId: row.accountId,
      env,
      err,
    });
    return {
      accountId: row.accountId,
      detailsSubmitted: row.detailsSubmitted,
      chargesEnabled: row.chargesEnabled,
      payoutsEnabled: row.payoutsEnabled,
    };
  }
}

/**
 * Resolve the base URL we hand to Stripe for return/refresh URLs, Checkout
 * success/cancel URLs, etc. — always derived from the incoming request's
 * origin so that redirects land back on whatever domain the user came in on.
 *
 * Safe on Vercel because the platform only routes traffic to this project
 * from domains explicitly added to it — an attacker can't spoof the Host
 * header to inject a foreign domain into our redirect URLs. This also makes
 * per-tenant custom domains "just work": a request from phhs1996.com gets
 * redirects back to phhs1996.com without any per-tenant config.
 *
 * In dev, this also handles whatever port `next dev` happened to pick.
 */
export function getBaseUrl(req: NextRequest): string {
  return req.nextUrl.origin;
}

/**
 * Build a same-origin Stripe return URL with a `connect` query param appended.
 *
 * `clientReturnPath` is a path supplied by the client (e.g.
 * `window.location.pathname + window.location.search`) so the user lands back
 * exactly where they were when they clicked "Set up payouts". The path is
 * validated to be same-origin (must start with "/", must not start with "//"
 * to block protocol-relative URL hijacks). If invalid or missing, we fall
 * back to `fallbackPath`.
 *
 * The connect status (`complete` or `refresh`) is merged as a query param
 * — preserving any other params that were already on the path.
 */
export function buildConnectReturnUrl(
  req: NextRequest,
  clientReturnPath: unknown,
  fallbackPath: string,
  connectStatus: "complete" | "refresh"
): string {
  const baseUrl = getBaseUrl(req);
  const safePath =
    typeof clientReturnPath === "string" &&
    clientReturnPath.startsWith("/") &&
    !clientReturnPath.startsWith("//")
      ? clientReturnPath
      : fallbackPath;
  const url = new URL(safePath, baseUrl);
  url.searchParams.set("connect", connectStatus);
  return url.toString();
}

export { Stripe };
