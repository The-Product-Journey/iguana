import { db } from "@/lib/db";
import { reunions, reunionAdmins, superAdmins } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { ManageAdminsClient } from "./manage-admins-client";
import {
  getInvitationStatusByEmails,
  type InviteStatus,
} from "@/lib/clerk-invites";

export const dynamic = "force-dynamic";

export default async function SuperAdminAdminsPage() {
  const ctx = await requireSuperAdminPage();

  const [allReunions, allReunionAdmins, allSuperAdmins] = await Promise.all([
    db.select().from(reunions).orderBy(asc(reunions.name)).all(),
    db.select().from(reunionAdmins).orderBy(asc(reunionAdmins.email)).all(),
    db.select().from(superAdmins).orderBy(asc(superAdmins.email)).all(),
  ]);

  // Resolve invitation status for every admin row in one Clerk call.
  // If Clerk is unreachable we still render; rows fall back to status
  // "none" which the UI treats as "no invite yet — send one".
  let inviteStatus: Map<string, InviteStatus>;
  try {
    inviteStatus = await getInvitationStatusByEmails([
      ...allReunionAdmins.map((a) => ({
        email: a.email,
        clerkUserId: a.clerkUserId,
      })),
      ...allSuperAdmins.map((a) => ({
        email: a.email,
        clerkUserId: a.clerkUserId,
      })),
    ]);
  } catch (err) {
    console.error("[admin/super/admins] invite status lookup failed", err);
    inviteStatus = new Map();
  }

  // Group reunion admins by reunion
  const byReunion: Record<string, typeof allReunionAdmins> = {};
  for (const a of allReunionAdmins) {
    if (!byReunion[a.reunionId]) byReunion[a.reunionId] = [];
    byReunion[a.reunionId].push(a);
  }

  // Plain-object representation so we can pass it across the server →
  // client boundary (Map isn't serializable through React's RSC
  // boundary).
  const inviteStatusObj: Record<string, InviteStatus> = {};
  for (const [email, status] of inviteStatus.entries()) {
    inviteStatusObj[email] = status;
  }

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm font-medium text-forest hover:text-forest-deep"
      >
        &larr; Back to admin
      </Link>

      <h2 className="mb-8 text-3xl font-semibold text-ink">Manage admins</h2>

      <ManageAdminsClient
        reunions={allReunions.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
        }))}
        adminsByReunion={byReunion}
        superAdmins={allSuperAdmins}
        currentEmail={ctx.email}
        inviteStatus={inviteStatusObj}
      />
    </div>
  );
}
