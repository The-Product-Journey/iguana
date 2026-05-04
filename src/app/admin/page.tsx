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
      <h2 className="mb-6 text-2xl font-bold">Choose a reunion</h2>
      {myReunions.length === 0 ? (
        <p className="text-gray-500">No reunions assigned yet.</p>
      ) : (
        <ul className="space-y-2">
          {myReunions.map((r) => (
            <li key={r.id}>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/${r.slug}`}
                    className="font-medium text-gray-900 hover:text-red-700"
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
                <div className="mt-1 text-sm text-gray-500">{r.eventDate}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
