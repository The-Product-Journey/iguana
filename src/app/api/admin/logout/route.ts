import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Use the request's own origin for the redirect — handles dev port shifts
  // (e.g. 3000 → 3002 when another project is on 3000) without depending
  // on NEXT_PUBLIC_BASE_URL being correct in .env.local.
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.delete("admin_auth");
  return res;
}
