import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AdminForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border-warm bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Not authorized</h1>
        <p className="mt-3 text-sm text-ink-muted">
          You&apos;re signed in, but you don&apos;t have access to this
          site. You may have access to other sites — visit your admin
          dashboard to check. If you think this is a mistake, ask the
          site&apos;s organizer to add you, or sign in with a different
          account.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <UserButton />
          <Link
            href="/admin"
            className="text-sm font-medium text-forest hover:text-forest-deep"
          >
            Go to admin →
          </Link>
        </div>
      </div>
    </div>
  );
}
