import { db } from "@/lib/db";
import { reunions, reunionAdmins, superAdmins } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { ManageAdminsClient } from "./manage-admins-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAdminsPage() {
  const ctx = await requireSuperAdminPage();

  const [allReunions, allReunionAdmins, allSuperAdmins] = await Promise.all([
    db.select().from(reunions).orderBy(asc(reunions.name)).all(),
    db.select().from(reunionAdmins).orderBy(asc(reunionAdmins.email)).all(),
    db.select().from(superAdmins).orderBy(asc(superAdmins.email)).all(),
  ]);

  // Group reunion admins by reunion
  const byReunion: Record<string, typeof allReunionAdmins> = {};
  for (const a of allReunionAdmins) {
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

      <h2 className="mb-6 text-2xl font-bold">Manage admins</h2>

      <ManageAdminsClient
        reunions={allReunions.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
        }))}
        adminsByReunion={byReunion}
        superAdmins={allSuperAdmins}
        currentEmail={ctx.email}
      />
    </div>
  );
}
