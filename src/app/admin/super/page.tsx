import { db } from "@/lib/db";
import { reunions, reunionAdmins } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import { LaunchSiteMenu } from "@/components/launch-site-menu";
import { TestTag } from "@/components/test-tag";

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
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-semibold text-ink">Super Admin</h2>
        <Link
          href="/admin/super/admins"
          className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep"
        >
          Manage admins →
        </Link>
      </div>

      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        All reunions
      </h3>
      <ul className="space-y-2">
        {counts.map(({ reunion, adminCount }) => (
          <li
            key={reunion.id}
            className="flex items-center justify-between rounded-xl border border-border-warm bg-white p-4 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/${reunion.slug}`}
                  className="font-medium text-ink hover:text-forest"
                >
                  {reunion.name}
                </Link>
                {reunion.slug.endsWith("-test") && <TestTag />}
                <LaunchSiteMenu
                  slug={reunion.slug}
                  reunionName={reunion.name}
                  customDomain={reunion.customDomain}
                  iconClassName="h-4 w-4"
                  triggerClassName="inline-flex h-5 w-5 items-center justify-center text-ink-subtle hover:text-forest"
                />
              </div>
              <div className="text-sm text-ink-muted">
                {reunion.eventDate} · mode: {reunion.siteMode}
              </div>
            </div>
            <div className="text-sm text-ink-muted">
              {adminCount} {adminCount === 1 ? "admin" : "admins"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
