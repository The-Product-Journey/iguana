import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAnyAdminPage } from "@/lib/admin-auth";
import { LaunchSiteMenu } from "@/components/launch-site-menu";

export const dynamic = "force-dynamic";

/**
 * Top-level /admin landing — a router that sends each user to the right place
 * based on their role:
 *   - Super admin → /admin/super
 *   - Reunion admin with one reunion → /admin/<slug>
 *   - Reunion admin with multiple → small picker page (shown below)
 *   - Anything else → /admin/forbidden (proxy already filters; defense in depth)
 */
export default async function AdminIndexPage() {
  const ctx = await requireAnyAdminPage();

  if (ctx.isSuper) {
    redirect("/admin/super");
  }

  // Reunion admin
  if (ctx.reunionIds.length === 1) {
    const reunion = await db
      .select({ slug: reunions.slug })
      .from(reunions)
      .where(inArray(reunions.id, ctx.reunionIds))
      .get();
    if (reunion) redirect(`/admin/${reunion.slug}`);
  }

  // Multiple reunions — picker
  const myReunions =
    ctx.reunionIds.length > 0
      ? await db
          .select()
          .from(reunions)
          .where(inArray(reunions.id, ctx.reunionIds))
          .all()
      : [];

  return (
    <div>
      <h2 className="mb-8 text-3xl font-semibold text-ink">Choose a reunion</h2>
      {myReunions.length === 0 ? (
        <p className="text-ink-muted">No reunions assigned yet.</p>
      ) : (
        <ul className="space-y-2">
          {myReunions.map((r) => (
            <li key={r.id}>
              <div className="rounded-xl border border-border-warm bg-white p-4 shadow-sm transition hover:border-border-strong hover:shadow-md">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/${r.slug}`}
                    className="font-medium text-ink hover:text-forest"
                  >
                    {r.name}
                  </Link>
                  {r.slug.endsWith("-test") && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                      Test
                    </span>
                  )}
                  <LaunchSiteMenu
                    slug={r.slug}
                    reunionName={r.name}
                    customDomain={r.customDomain}
                  />
                </div>
                <div className="mt-1 text-sm text-ink-muted">{r.eventDate}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
