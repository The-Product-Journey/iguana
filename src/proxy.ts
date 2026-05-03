/**
 * Next.js 16 proxy (formerly middleware.ts in Next ≤15).
 *
 * Coarse-gate model:
 *   - For /admin(.*) and /api/admin(.*): require a signed-in user. If not,
 *     page routes redirect to /sign-in (with returnBackUrl), API routes
 *     return 403 JSON. /admin/forbidden is whitelisted to avoid loops.
 *   - For everything else: do nothing. Public reunion pages still pass
 *     through here so that Clerk's auth() works downstream when called
 *     from getAdminPreviewState() — that's why the matcher is broad.
 *
 * **Role enforcement does NOT happen here.** It happens at:
 *   - per-page guards: requireSuperAdminPage / requireReunionAdminPage(id)
 *     / requireAnyAdminPage (in src/lib/admin-auth.ts)
 *   - per-route guards: requireSuperAdmin / requireReunionAdmin(id) /
 *     requireAnyAdmin (same module)
 *
 * Why not in the proxy: inside clerkMiddleware, the imported `auth()` from
 * `@clerk/nextjs/server` doesn't work — only the `auth` parameter passed to
 * the callback does. Our role helpers call the imported `auth()` so they
 * can be reused from server components and route handlers — which means
 * they MUST run after the proxy, not inside it.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminApi = createRouteMatcher(["/api/admin(.*)"]);
const isAdminPage = createRouteMatcher(["/admin(.*)"]);
const isForbiddenPage = createRouteMatcher(["/admin/forbidden(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // /admin/forbidden is whitelisted — it itself matches /admin(.*) and
  // would otherwise redirect-loop a signed-out non-admin who lands here.
  if (isForbiddenPage(req)) return;

  // Only enforce on admin surfaces. Non-admin routes still flow through
  // clerkMiddleware so downstream auth() calls work, but no redirect/gate.
  const matched = isAdminApi(req) || isAdminPage(req);
  if (!matched) return;

  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    if (isAdminApi(req)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Signed in — let the request flow. Page guards / route guards handle
  // role checks (super vs. reunion vs. none) and redirect to
  // /admin/forbidden or return 403 as appropriate.
});

export const config = {
  matcher: [
    // Clerk requires the proxy to RUN on every route where `auth()` is
    // called — and lib/site-mode.ts calls it from public reunion pages
    // (/[slug] et al.) to compute admin preview state. So the matcher
    // must be broad. The PROXY LOGIC above narrows enforcement to
    // /admin(.*) and /api/admin(.*) — everything else just gets Clerk
    // context populated and falls through.
    //
    // Standard Clerk pattern: skip Next internals and common static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    "/(api|trpc)(.*)",
  ],
};
