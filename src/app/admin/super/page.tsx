import { db } from "@/lib/db";
import { reunions, reunionAdmins } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { LaunchSiteMenu } from "@/components/launch-site-menu";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await requireSuperAdminPage();

  const all = await db.select().from(reunions).all();

  const counts = await Promise.all(
    all.map(async (r) => {
      const c = await db
        .select({ n: sql<number>`count(*)` })
        .from(reunionAdmins)
        .where(eq(reunionAdmins.reunionId, r.id))
        .get();
      return { reunion: r, adminCount: c?.n ?? 0 };
    })
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Super Admin</h2>
        <Link
          href="/admin/super/admins"
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
        >
          Manage admins →
        </Link>
      </div>

      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        All reunions
      </h3>
      <ul className="space-y-2">
        {counts.map(({ reunion, adminCount }) => (
          <li
            key={reunion.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/${reunion.slug}`}
                  className="font-medium hover:text-red-700"
                >
                  {reunion.name}
                </Link>
                {reunion.slug.endsWith("-test") && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                    Test
                  </span>
                )}
                <LaunchSiteMenu
                  slug={reunion.slug}
                  reunionName={reunion.name}
                  customDomain={reunion.customDomain}
                  iconClassName="h-4 w-4"
                  triggerClassName="inline-flex h-5 w-5 items-center justify-center text-gray-400 hover:text-gray-700"
                />
              </div>
              <div className="text-sm text-gray-500">
                {reunion.eventDate} · mode: {reunion.siteMode}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {adminCount} {adminCount === 1 ? "admin" : "admins"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
