import { db } from "@/lib/db";
import { reunions, reunionAdmins } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { ManageAdminsClient } from "./manage-admins-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAdminsPage() {
  await requireSuperAdminPage();

  const allReunions = await db
    .select()
    .from(reunions)
    .orderBy(asc(reunions.name))
    .all();

  const allAdmins = await db
    .select()
    .from(reunionAdmins)
    .orderBy(asc(reunionAdmins.email))
    .all();

  // Group admins by reunion
  const byReunion: Record<string, typeof allAdmins> = {};
  for (const a of allAdmins) {
    if (!byReunion[a.reunionId]) byReunion[a.reunionId] = [];
    byReunion[a.reunionId].push(a);
  }

  return (
    <div>
      <Link
        href="/admin/super"
        className="mb-4 inline-block text-sm text-red-700 hover:text-red-800"
      >
        &larr; Back to super admin
      </Link>

      <h2 className="mb-6 text-2xl font-bold">Manage reunion admins</h2>

      <ManageAdminsClient
        reunions={allReunions.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
        }))}
        adminsByReunion={byReunion}
      />
    </div>
  );
}
