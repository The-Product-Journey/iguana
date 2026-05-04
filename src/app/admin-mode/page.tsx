import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Admin-mode entry point. Used by the "Admin Mode" link on public reunion
 * pages so admins can hop onto the canonical Clerk-bound domain (where
 * admin UI actually works) without losing their place in the navigation.
 *
 * The route lives under the `/admin-` prefix so the proxy's admin gate
 * (`/admin(.*)`) catches it: cross-domain requests get bounced to canonical
 * automatically, and the auth check forces a sign-in for visitors who
 * aren't logged in. By the time this server component runs, the user is
 * signed in on the canonical domain — we just redirect to the return path.
 *
 * `return` is validated as a same-origin relative path before redirect to
 * block protocol-relative URL hijacks like `?return=//evil.com`.
 */
export default async function AdminMode({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const { return: returnParam } = await searchParams;
  const safePath =
    typeof returnParam === "string" &&
    returnParam.startsWith("/") &&
    !returnParam.startsWith("//")
      ? returnParam
      : "/";
  redirect(safePath);
}
