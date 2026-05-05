"use client";

import { UserButton, useClerk } from "@clerk/nextjs";

/**
 * Clerk UserButton with a conditional "Super Admin" link in the menu
 * and a hard-reload sign-out.
 *
 * Why override sign-out: Clerk's default signOut() clears the session
 * cookie and soft-navigates. But Next.js's RSC client cache holds
 * server-rendered payloads from when the user was signed in — so soft
 * navigation back into admin routes serves cached output instead of
 * hitting the server's auth gate. Doing window.location.assign() after
 * signOut() throws away all client state and forces a fresh request,
 * so the proxy correctly bounces unauthenticated users to /sign-in.
 *
 * The `isSuper` flag is resolved server-side (via getCurrentAdminContext)
 * and passed in — the client never decides on its own who's a super
 * admin.
 *
 * Custom <UserButton.Link> items render above the default actions in
 * Clerk's menu.
 */
export function UserMenu({ isSuper }: { isSuper: boolean }) {
  const clerk = useClerk();

  async function handleSignOut() {
    await clerk.signOut();
    // Hard reload: wipes Next's RSC client cache + any stale React
    // tree state, so the next page load goes through the proxy clean.
    window.location.assign("/");
  }

  return (
    <UserButton>
      <UserButton.MenuItems>
        {isSuper && (
          <UserButton.Link
            label="Super Admin"
            labelIcon={<ShieldIcon />}
            href="/admin"
          />
        )}
        <UserButton.Action
          label="signOut"
          labelIcon={null}
          onClick={handleSignOut}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.5 2.5 3.5v4.25c0 3 2.25 5.5 5.5 6.75 3.25-1.25 5.5-3.75 5.5-6.75V3.5L8 1.5Z" />
    </svg>
  );
}
