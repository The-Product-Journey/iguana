import { db } from "@/lib/db";
import { reunions, reunionAdmins } from "@/lib/db/schema";
import { sql, eq, asc, inArray } from "drizzle-orm";
import Link from "next/link";
import { requireAnyAdminPage } from "@/lib/admin-auth";
import { LaunchSiteMenu } from "@/components/launch-site-menu";
import { TestTag } from "@/components/test-tag";

export const dynamic = "force-dynamic";

/**
 * Unified admin landing.
 *
 * Same layout for super admins and reunion admins. Differences:
 *   - Heading reads "Super Admin" vs "Admin"
 *   - "Manage admins" button only shows for super admins
 *   - Super admins see every active+inactive reunion + admin counts
 *   - Reunion admins see only the reunions they're attached to (no
 *     admin counts — they don't manage other admins)
 *
 * Single-reunion admins used to be auto-redirected straight to
 * /admin/<slug>. We now always render the list so the surface is
 * predictable and consistent across roles.
 */
export default async function AdminLandingPage() {
  const ctx = await requireAnyAdminPage();

  const sites = ctx.isSuper
    ? await db.select().from(reunions).orderBy(asc(reunions.name)).all()
    : ctx.reunionIds.length > 0
      ? await db
          .select()
          .from(reunions)
          .where(inArray(reunions.id, ctx.reunionIds))
          .orderBy(asc(reunions.name))
          .all()
      : [];

  // Admin counts only matter (and are loaded) for super admins.
  const counts: { reunion: (typeof sites)[number]; adminCount: number }[] =
    ctx.isSuper
      ? await Promise.all(
          sites.map(async (r) => {
            const c = await db
              .select({ n: sql<number>`count(*)` })
              .from(reunionAdmins)
              .where(eq(reunionAdmins.reunionId, r.id))
              .get();
            return { reunion: r, adminCount: c?.n ?? 0 };
          })
        )
      : sites.map((r) => ({ reunion: r, adminCount: 0 }));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-semibold text-ink">
          {ctx.isSuper ? "Super Admin" : "Admin"}
        </h2>
        {ctx.isSuper && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/super/payments"
              className="rounded-lg border border-forest px-4 py-2 text-sm font-medium text-forest transition hover:bg-cream"
            >
              Manage payments →
            </Link>
            <Link
              href="/admin/super/admins"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep"
            >
              Manage admins →
            </Link>
          </div>
        )}
      </div>

      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {ctx.isSuper ? "All sites" : "Your sites"}
      </h3>

      {sites.length === 0 ? (
        <p className="text-sm text-ink-subtle">No sites assigned yet.</p>
      ) : (
        <ul className="space-y-2">
          {counts.map(({ reunion, adminCount }) => (
            <li
              key={reunion.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-warm bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/${reunion.slug}`}
                    className="font-medium text-ink hover:text-forest"
                  >
                    {reunion.name}
                  </Link>
                  {reunion.slug.endsWith("-test") && <TestTag />}
                </div>
                <div className="text-sm text-ink-muted">
                  {reunion.eventDate} · mode: {reunion.siteMode}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {ctx.isSuper && (
                  <span className="text-sm text-ink-muted">
                    {adminCount} {adminCount === 1 ? "admin" : "admins"}
                  </span>
                )}
                <LaunchSiteMenu
                  slug={reunion.slug}
                  reunionName={reunion.name}
                  customDomain={reunion.customDomain}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
