import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { AdminPreviewBanner } from "@/components/admin-preview-banner";
import { getAdminPreviewState } from "@/lib/site-mode";

export default async function ReunionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();

  if (!reunion) notFound();

  const previewState = await getAdminPreviewState(reunion);
  const effectiveMode = previewState.effectiveMode;

  // Don't show nav on tease mode landing (it has its own design)
  const showNav = effectiveMode !== "tease";

  return (
    <>
      {/* Tiny top utility bar — admin login / admin panel + sign out.
          Public visitors barely notice; admins have a one-click route
          back to the admin panel from anywhere on the site. */}
      <div className="border-b border-gray-100 bg-white/80 px-6 text-xs">
        <div className="mx-auto flex h-7 max-w-5xl items-center justify-end gap-3 text-gray-400">
          {previewState.isAdmin ? (
            <>
              <Link
                href="/admin"
                className="hover:text-gray-700"
              >
                Admin panel
              </Link>
              <span aria-hidden="true">·</span>
              <form action="/api/admin/logout" method="POST">
                <button
                  type="submit"
                  className="hover:text-gray-700"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/admin" className="hover:text-gray-700">
              Admin login
            </Link>
          )}
        </div>
      </div>

      {previewState.isAdmin && (
        <AdminPreviewBanner
          previewMode={previewState.previewMode}
          actualMode={previewState.actualMode}
        />
      )}
      {showNav && (
        <SiteNav
          slug={slug}
          reunionName={reunion.name}
          siteMode={effectiveMode}
        />
      )}
      {children}
    </>
  );
}
