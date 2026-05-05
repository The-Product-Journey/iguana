import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { UserMenu } from "@/components/user-menu";
import { getCurrentAdminContext } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced upstream:
  //   - src/proxy.ts gates /admin(.*) on signed-in + any-admin
  //   - per-page helpers (e.g. requireReunionAdminPage on /admin/[slug])
  //     enforce per-reunion scope
  // We still resolve admin context here so the UserMenu can show the
  // Super Admin shortcut to the right people.
  const ctx = await getCurrentAdminContext();
  return (
    <div className="min-h-screen bg-bg-subtle">
      <nav className="border-b border-border-warm bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Glad You Made It home">
            <Wordmark className="h-7 w-auto" />
          </Link>
          {/* afterSignOutUrl is configured globally on ClerkProvider in
              src/app/layout.tsx — see Clerk v7 prop changes. */}
          <UserMenu isSuper={!!ctx?.isSuper} />
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
