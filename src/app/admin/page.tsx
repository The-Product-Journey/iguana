import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAnyAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Top-level /admin landing — a router that sends each user to the right place
 * based on their role:
 *   - Super admin → /admin/super
 *   - Reunion admin with one reunion → /admin/<slug>
 *   - Reunion admin with multiple → small picker page
 *   - Anything else → /admin/forbidden (proxy already filters, this is
 *     defense in depth)
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
              <Link
                href={`/admin/${r.slug}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-gray-500">{r.eventDate}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
