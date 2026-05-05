"use client";

import { UserButton } from "@clerk/nextjs";

/**
 * Clerk UserButton with a conditional "Super Admin" link in the menu.
 * The `isSuper` flag is resolved server-side (via getCurrentAdminContext)
 * and passed in — the client never decides on its own who's a super
 * admin.
 *
 * Custom `<UserButton.Link>` items render above the default "Sign out"
 * action in Clerk's menu.
 */
export function UserMenu({ isSuper }: { isSuper: boolean }) {
  return (
    <UserButton>
      {isSuper && (
        <UserButton.MenuItems>
          <UserButton.Link
            label="Super Admin"
            labelIcon={<ShieldIcon />}
            href="/admin"
          />
        </UserButton.MenuItems>
      )}
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
