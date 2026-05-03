import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PREVIEW_COOKIE, SITE_MODES } from "@/lib/site-mode";
import { requireAnyAdmin } from "@/lib/admin-auth";

/**
 * POST: set the preview cookie to a SiteMode (or null/empty/undefined to clear).
 * DELETE: clear the preview cookie. Used by admin-menu.tsx before sign-out
 *         since the cookie is httpOnly and can't be cleared from JS.
 *
 * Both routes require an admin (super OR any-reunion); per-reunion enforcement
 * happens at the page render layer (the cookie is just a UI signal).
 */
export async function POST(req: NextRequest) {
  const guard = await requireAnyAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  // mode === null (or omitted) clears the override -> admin sees public view
  if (body.mode === null || body.mode === undefined || body.mode === "") {
    res.cookies.delete(ADMIN_PREVIEW_COOKIE);
    return res;
  }

  if (
    typeof body.mode !== "string" ||
    !SITE_MODES.includes(body.mode as (typeof SITE_MODES)[number])
  ) {
    return NextResponse.json(
      {
        error: `Invalid mode. Must be one of: ${SITE_MODES.join(", ")} (or null to clear).`,
      },
      { status: 400 }
    );
  }

  res.cookies.set(ADMIN_PREVIEW_COOKIE, body.mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Session-scoped — preview shouldn't outlive the browser session
  });
  return res;
}

export async function DELETE() {
  const guard = await requireAnyAdmin();
  if (guard instanceof NextResponse) return guard;

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_PREVIEW_COOKIE);
  return res;
}
