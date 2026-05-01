import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_PREVIEW_COOKIE, SITE_MODES } from "@/lib/site-mode";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("admin_auth");
  if (auth?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
