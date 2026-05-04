/**
 * Next.js 16 proxy (formerly middleware.ts in Next ≤15).
 *
 * Three responsibilities, in order:
 *
 *   1. **Cross-domain auth hop.** Requests to auth surfaces (`/admin`,
 *      `/api/admin`, `/sign-in`, `/sign-up`) arriving on a non-canonical host
 *      are 307'd to the canonical auth origin. This lets reunions use vanity
 *      public-facing domains while keeping auth on the Clerk-bound canonical
 *      host. Activated only when `NEXT_PUBLIC_AUTH_ORIGIN` is set, so dev and
 *      preview deploys (which don't have a canonical) just pass through.
 *
 *   2. **Per-tenant vanity rewrite.** Hardcoded host→slug map (see
 *      `TENANT_DOMAIN_TO_SLUG` below). When a request arrives on a vanity
 *      domain, the path is internally rewritten to prepend the slug — so
 *      `www.parkhill1996reunion.com/yearbook` serves the same content as
 *      `app.gladyoumadeit.com/phhs-1996/yearbook` while the visible URL
 *      stays clean. Auth surfaces are skipped (handled by step 1) and so
 *      are paths that already start with the slug.
 *
 *   3. **Coarse admin gate.** For `/admin(.*)` and `/api/admin(.*)`: require
 *      a signed-in user. If not, page routes redirect to `/sign-in` (with
 *      returnBackUrl), API routes return 403 JSON. `/admin/forbidden` is
 *      whitelisted to avoid loops.
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
const isAuthPage = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isForbiddenPage = createRouteMatcher(["/admin/forbidden(.*)"]);

// Vanity-domain → reunion-slug map. Add new entries here when a reunion
// gets its own custom public-facing domain. Include both apex and `www.`
// variants if both DNS records are configured. Auth surfaces (admin/sign-in)
// arriving on these hosts get bounced to the canonical origin instead of
// being rewritten — see step 1 above.
const TENANT_DOMAIN_TO_SLUG: Record<string, string> = {
  "parkhill1996reunion.com": "phhs-1996",
  "www.parkhill1996reunion.com": "phhs-1996",
};

export default clerkMiddleware(async (auth, req) => {
  if (isForbiddenPage(req)) return;

  const host = req.headers.get("host") ?? "";
  const isAuthSurface =
    isAdminApi(req) || isAdminPage(req) || isAuthPage(req);

  // 1. Cross-domain auth hop — must run before anything else so vanity-host
  //    auth requests never reach Clerk on the wrong cookie domain.
  const canonicalOrigin = process.env.NEXT_PUBLIC_AUTH_ORIGIN;
  if (canonicalOrigin && isAuthSurface) {
    const canonicalHost = new URL(canonicalOrigin).host;
    if (host && host !== canonicalHost) {
      const target = new URL(
        req.nextUrl.pathname + req.nextUrl.search,
        canonicalOrigin
      );
      return NextResponse.redirect(target, 307);
    }
  }

  // 2. Per-tenant vanity-domain rewrite. Only for non-auth, non-API paths
  //    that don't already include the slug. The rewrite is internal —
  //    the user keeps seeing the vanity URL in their browser.
  const slugForHost = TENANT_DOMAIN_TO_SLUG[host];
  if (
    slugForHost &&
    !isAuthSurface &&
    !req.nextUrl.pathname.startsWith("/api/") &&
    !req.nextUrl.pathname.startsWith(`/${slugForHost}`)
  ) {
    const path = req.nextUrl.pathname;
    const rewritten = req.nextUrl.clone();
    rewritten.pathname = `/${slugForHost}${path === "/" ? "" : path}`;
    return NextResponse.rewrite(rewritten);
  }

  // 3. Admin gate — only enforce on admin surfaces. Other routes still flow
  //    through clerkMiddleware so downstream auth() calls work, but no
  //    redirect/gate.
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
