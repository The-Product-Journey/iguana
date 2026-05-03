import { UserButton } from "@clerk/nextjs";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced upstream:
  //   - src/proxy.ts gates /admin(.*) on signed-in + any-admin
  //   - per-page helpers (e.g. requireReunionAdminPage on /admin/[slug])
  //     enforce per-reunion scope
  // This layout no longer needs a cookie check.
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Reunion Admin
          </h1>
          {/* afterSignOutUrl is configured globally on ClerkProvider in
              src/app/layout.tsx — see Clerk v7 prop changes. */}
          <UserButton />
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
