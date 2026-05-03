import Stripe from "stripe";
import type { NextRequest } from "next/server";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

/**
 * Resolve the canonical base URL we hand to Stripe for return/refresh URLs,
 * Checkout success/cancel URLs, etc.
 *
 * In production, we trust the explicit `NEXT_PUBLIC_BASE_URL` env var — it's
 * the canonical public origin (e.g. `https://reunion.example.com`). We never
 * derive from request headers in prod because those can be spoofed.
 *
 * In dev (or when the env var is missing/non-https), we derive from the
 * request's own origin. This means whatever port `next dev` actually picked
 * (3000, 3002, whatever) gets used, which fixes the "wrong port" redirect
 * problem when 3000 is taken.
 */
export function getBaseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl && envUrl.startsWith("https://")) {
    return envUrl.replace(/\/$/, "");
  }
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
