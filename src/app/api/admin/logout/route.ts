import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Drop the user back at the root after sign-out (which redirects to
  // the active reunion's public homepage). Avoids the awkward UX of
  // landing on the admin login page right after signing out.
  // Use req.url as the base so dev port shifts (3000 -> 3002) work.
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("admin_auth");
  res.cookies.delete("admin_preview_mode");
  return res;
}
