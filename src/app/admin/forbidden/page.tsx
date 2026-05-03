import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AdminForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Not authorized
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          You're signed in, but this email isn't on the admin allowlist for
          any reunion. If you think this is a mistake, ask the reunion's
          organizer to add you, or sign in with a different account.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <UserButton />
          <Link
            href="/"
            className="text-sm text-red-700 hover:text-red-800"
          >
            Go to homepage →
          </Link>
        </div>
      </div>
    </div>
  );
}
