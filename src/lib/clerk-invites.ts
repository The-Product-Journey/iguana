import { clerkClient } from "@clerk/nextjs/server";

/**
 * Clerk-backed admin invitation helpers.
 *
 * The platform's auth model is "email allowlist + Clerk sign-in":
 *   1. A super admin adds an email to either super_admins or
 *      reunion_admins in our DB (via the manage-admins UI).
 *   2. We send a Clerk invitation to that email — Clerk emails them a
 *      sign-up link with a redirect back to /admin once they finish.
 *   3. On their first sign-in, getCurrentAdminContext() backfills
 *      clerkUserId on the matching admin row.
 *
 * Staging and production share the same DB (Turso). Invitations should
 * therefore be issued from the *production* Clerk instance (same Clerk
 * app the email allowlist is anchored to). NEXT_PUBLIC_AUTH_ORIGIN is
 * set on the production deploy and points at the canonical sign-in
 * surface — the redirect URL we ask Clerk to send users back to after
 * accepting.
 */

const FALLBACK_REDIRECT_ORIGIN = "https://app.gladyoumadeit.com";

function redirectOrigin(): string {
  return process.env.NEXT_PUBLIC_AUTH_ORIGIN ?? FALLBACK_REDIRECT_ORIGIN;
}

export type InviteStatus =
  | { kind: "active" } // user has signed in (clerkUserId is set on the admin row)
  | { kind: "pending"; invitationId: string; createdAt: number }
  | { kind: "expired"; invitationId: string; createdAt: number }
  | { kind: "revoked"; invitationId: string; createdAt: number }
  | { kind: "none" }; // no Clerk invitation has ever been sent

/**
 * Send a fresh invitation to `email`. Caller is responsible for
 * revoking any prior pending invite first if needed (use
 * revokePendingInvite). On Clerk failure this throws — callers wrap so
 * a Clerk outage doesn't block the DB-allowlist write.
 *
 * The redirectUrl is the page the user lands on AFTER completing
 * sign-up via Clerk's Account Portal. The Account Portal handles the
 * __clerk_ticket query param itself (we don't host a SignUp component
 * locally), so we can just pass the final admin destination here.
 */
export async function sendAdminInvite(
  email: string,
  redirectPath: string = "/admin"
): Promise<{ id: string }> {
  const client = await clerkClient();
  const inv = await client.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${redirectOrigin()}${redirectPath}`,
    notify: true,
    ignoreExisting: false,
  });
  return { id: inv.id };
}

/**
 * Find any pending Clerk invitation for `email` and revoke it. Returns
 * true if an invite was revoked, false if nothing was pending.
 */
export async function revokePendingInvite(email: string): Promise<boolean> {
  const client = await clerkClient();
  const list = await client.invitations.getInvitationList({
    status: "pending",
  });
  const target = list.data.find(
    (i) => i.emailAddress.toLowerCase() === email.toLowerCase()
  );
  if (!target) return false;
  await client.invitations.revokeInvitation(target.id);
  return true;
}

/**
 * Bulk-fetch invitation status keyed by email (lower-cased). The admin
 * row's own clerkUserId takes precedence — if it's set, we report
 * "active" without needing Clerk. Otherwise we look at the most recent
 * invitation Clerk knows about.
 */
export async function getInvitationStatusByEmails(
  rows: Array<{ email: string; clerkUserId: string | null }>
): Promise<Map<string, InviteStatus>> {
  const map = new Map<string, InviteStatus>();
  if (rows.length === 0) return map;

  // Active wins — anyone with a backfilled clerkUserId is fully signed
  // in regardless of what state Clerk has the invitation in (for
  // example a user might sign up via a different invite or have an
  // expired one in history).
  const inactiveEmails = new Set<string>();
  for (const r of rows) {
    const email = r.email.toLowerCase();
    if (r.clerkUserId) {
      map.set(email, { kind: "active" });
    } else {
      inactiveEmails.add(email);
    }
  }

  if (inactiveEmails.size === 0) return map;

  // Fetch all invitation statuses in parallel. Clerk's list API
  // doesn't filter by email directly in all SDK versions, so we pull
  // recent pages and match locally. For a small admin team this is
  // negligible.
  const client = await clerkClient();
  const list = await client.invitations.getInvitationList({ limit: 100 });

  // Keep the most recent invitation per email (regardless of status)
  // so the UI can show "expired/revoked" rather than silently falling
  // back to "no invite ever sent".
  const newestByEmail = new Map<string, (typeof list.data)[number]>();
  for (const inv of list.data) {
    const email = inv.emailAddress.toLowerCase();
    if (!inactiveEmails.has(email)) continue;
    const existing = newestByEmail.get(email);
    if (!existing || inv.createdAt > existing.createdAt) {
      newestByEmail.set(email, inv);
    }
  }

  for (const email of inactiveEmails) {
    const inv = newestByEmail.get(email);
    if (!inv) {
      map.set(email, { kind: "none" });
      continue;
    }
    if (inv.status === "pending") {
      map.set(email, {
        kind: "pending",
        invitationId: inv.id,
        createdAt: inv.createdAt,
      });
    } else if (inv.status === "expired") {
      map.set(email, {
        kind: "expired",
        invitationId: inv.id,
        createdAt: inv.createdAt,
      });
    } else if (inv.status === "revoked") {
      map.set(email, {
        kind: "revoked",
        invitationId: inv.id,
        createdAt: inv.createdAt,
      });
    } else {
      // "accepted" without a clerkUserId backfill — race condition
      // (they signed up but haven't loaded a page yet that runs
      // backfill). Treat as active; the next page load will catch up.
      map.set(email, { kind: "active" });
    }
  }

  return map;
}
