/**
 * Admin auth helpers — two-tier role model on top of Clerk.
 *
 * Tiers
 *   - Super admin: emails listed in env var SUPER_ADMIN_EMAILS (CSV).
 *     Has access to every reunion. Bootstrap path; no DB row required.
 *   - Reunion admin: rows in `reunion_admins` table linking an email to a
 *     specific reunion. Same email may admin multiple reunions via multiple rows.
 *
 * Per-route mapping (where each admin API handler reads its reunionId from)
 * — keep this synced when handlers move:
 *   - toggle-registration  → request body { reunionId }
 *   - memorial             → body { memorialId }; lookup memorials.reunionId
 *   - sponsors             → body { sponsorId };  lookup sponsors.reunionId
 *   - profiles             → body { profileId }; profiles has no reunionId
 *                            column — join through rsvps.reunionId
 *   - site-mode            → request body { reunionId }
 *   - preview-mode         → no reunion context; requireAnyAdmin (UI cookie only)
 *   - connect/create       → body { reunionId }
 *   - connect/onboarding-link → body { reunionId }
 *   - connect/login-link   → body { reunionId }
 *   - connect/status       → query string ?reunionId=...   (NOT body)
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunionAdmins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type AdminContext = {
  userId: string;
  email: string;
  isSuper: boolean;
  /** All reunion IDs this user is a reunion-admin for (excludes super status). */
  reunionIds: string[];
};

const FORBIDDEN_RESPONSE = () =>
  NextResponse.json({ error: "forbidden" }, { status: 403 });

/**
 * Membership-test the lowercased email against SUPER_ADMIN_EMAILS.
 * Empty/missing env returns false for everyone (fail-closed).
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Does (email, reunionId) have a row in reunion_admins?
 *
 * Wrapped in try/catch so a missing table or DB hiccup fails closed instead
 * of throwing 500s site-wide. This is the runtime safety net for the
 * schema-vs-deploy ordering risk: if production deploy lands before
 * `db:push` ran in prod, every reunion-admin check denies (which the
 * Operator Recovery Runbook documents how to fix), but the site stays up.
 */
export async function isReunionAdmin(
  email: string | null | undefined,
  reunionId: string
): Promise<boolean> {
  if (!email) return false;
  try {
    const row = await db
      .select({ id: reunionAdmins.id })
      .from(reunionAdmins)
      .where(
        and(
          eq(reunionAdmins.email, email.toLowerCase()),
          eq(reunionAdmins.reunionId, reunionId)
        )
      )
      .get();
    return !!row;
  } catch (err) {
    console.error("[admin-auth] isReunionAdmin lookup failed", err);
    return false;
  }
}

/**
 * Resolve the current admin context.
 *
 * Reads email from `sessionClaims.email` (configured via Clerk's session
 * token JWT template — see PLAN task 2). Falls back to currentUser() only
 * when sessionClaims.email is missing, since currentUser() is a Backend API
 * call with rate limits and runs on every public reunion page render via
 * lib/site-mode.ts. For signed-out visitors this short-circuits to null
 * with zero DB or Clerk Backend API calls.
 *
 * Side effect: if the user is signed in and a `reunion_admins` row matches
 * their email but has a null clerkUserId, backfill it. Best-effort,
 * try/catch wrapped — failures are logged but never crash the request.
 */
export async function getCurrentAdminContext(): Promise<AdminContext | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  let email = (sessionClaims as { email?: string } | null)?.email;
  if (!email) {
    // Fallback path — only hit if the JWT template wasn't configured.
    try {
      const u = await currentUser();
      email = u?.primaryEmailAddress?.emailAddress;
    } catch (err) {
      console.error("[admin-auth] currentUser fallback failed", err);
    }
  }
  if (!email) return null;
  email = email.toLowerCase();

  const isSuper = isSuperAdmin(email);

  let reunionIds: string[] = [];
  try {
    const rows = await db
      .select({
        reunionId: reunionAdmins.reunionId,
        clerkUserId: reunionAdmins.clerkUserId,
        id: reunionAdmins.id,
      })
      .from(reunionAdmins)
      .where(eq(reunionAdmins.email, email))
      .all();
    reunionIds = rows.map((r) => r.reunionId);

    // Best-effort backfill of clerkUserId on first sign-in by this email.
    const toBackfill = rows.filter((r) => !r.clerkUserId);
    if (toBackfill.length > 0) {
      try {
        await Promise.all(
          toBackfill.map((r) =>
            db
              .update(reunionAdmins)
              .set({ clerkUserId: userId })
              .where(eq(reunionAdmins.id, r.id))
          )
        );
      } catch (err) {
        console.error("[admin-auth] clerkUserId backfill failed", err);
      }
    }
  } catch (err) {
    console.error("[admin-auth] reunion_admins lookup failed", err);
    reunionIds = [];
  }

  return { userId, email, isSuper, reunionIds };
}

// ---------------------------------------------------------------------------
// API guards (for route.ts handlers — return NextResponse on fail)
// ---------------------------------------------------------------------------

export async function requireSuperAdmin(): Promise<
  AdminContext | NextResponse
> {
  const ctx = await getCurrentAdminContext();
  if (!ctx || !ctx.isSuper) return FORBIDDEN_RESPONSE();
  return ctx;
}

export async function requireReunionAdmin(
  reunionId: string
): Promise<AdminContext | NextResponse> {
  const ctx = await getCurrentAdminContext();
  if (!ctx) return FORBIDDEN_RESPONSE();
  if (ctx.isSuper) return ctx;
  if (ctx.reunionIds.includes(reunionId)) return ctx;
  return FORBIDDEN_RESPONSE();
}

export async function requireAnyAdmin(): Promise<AdminContext | NextResponse> {
  const ctx = await getCurrentAdminContext();
  if (!ctx) return FORBIDDEN_RESPONSE();
  if (ctx.isSuper || ctx.reunionIds.length > 0) return ctx;
  return FORBIDDEN_RESPONSE();
}

// ---------------------------------------------------------------------------
// Page guards (for server components — redirect on fail)
// ---------------------------------------------------------------------------

/**
 * Page-guard helpers redirect via Clerk's auth().redirectToSignIn() for the
 * unauth case (preserves Clerk's configured sign-in URL + returnBackUrl) and
 * Next's redirect() for the unauthorized-but-signed-in case. Both throw, so
 * the caller never reaches the return statement on failure paths.
 */
async function pageRedirectToSignIn(): Promise<never> {
  const { redirectToSignIn } = await auth();
  redirectToSignIn();
  // Unreachable — redirectToSignIn() throws.
  throw new Error("redirectToSignIn did not throw");
}

export async function requireSuperAdminPage(): Promise<AdminContext> {
  const ctx = await getCurrentAdminContext();
  if (!ctx) await pageRedirectToSignIn();
  if (!ctx!.isSuper) redirect("/admin/forbidden");
  return ctx!;
}

export async function requireReunionAdminPage(
  reunionId: string
): Promise<AdminContext> {
  const ctx = await getCurrentAdminContext();
  if (!ctx) await pageRedirectToSignIn();
  if (!ctx!.isSuper && !ctx!.reunionIds.includes(reunionId)) {
    redirect("/admin/forbidden");
  }
  return ctx!;
}

export async function requireAnyAdminPage(): Promise<AdminContext> {
  const ctx = await getCurrentAdminContext();
  if (!ctx) await pageRedirectToSignIn();
  if (!ctx!.isSuper && ctx!.reunionIds.length === 0) {
    redirect("/admin/forbidden");
  }
  return ctx!;
}
