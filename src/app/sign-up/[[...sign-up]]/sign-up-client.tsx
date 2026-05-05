"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

/**
 * Reads `next` from the query string and passes it to <SignUp> as
 * `forceRedirectUrl`. This is how invitation flow lands a freshly
 * onboarded admin on the right page — sendAdminInvite encodes the
 * caller's redirectPath as `next`, and we honor it after Clerk
 * finishes the sign-up.
 *
 * Falls back to /admin (the role-based router) when `next` is missing
 * or doesn't start with `/`.
 */
export function SignUpClient() {
  const params = useSearchParams();
  const next = params.get("next");
  const forceRedirectUrl =
    next && next.startsWith("/") ? next : "/admin";
  return <SignUp forceRedirectUrl={forceRedirectUrl} />;
}
