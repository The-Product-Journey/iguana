import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { CreateReunionClient } from "./create-reunion-client";

export const dynamic = "force-dynamic";

export default async function NewReunionPage() {
  await requireSuperAdminPage();

  return (
    <div>
      <Link
        href="/admin/super"
        className="mb-4 inline-block text-sm text-red-700 hover:text-red-800"
      >
        &larr; Back to super admin
      </Link>

      <h2 className="mb-2 text-2xl font-bold">Create new reunion</h2>
      <p className="mb-6 max-w-xl text-sm text-gray-600">
        Create a fresh tenant. Required fields are slug, name, and event date.
        Branding and copy fields can be filled in later from the reunion&apos;s
        settings page. Toggling &quot;with demo data&quot; lays down realistic
        sample content (events, RSVPs, sponsors, profiles) so the new reunion
        has something to look at before its admins start adding real data.
      </p>

      <CreateReunionClient />
    </div>
  );
}
