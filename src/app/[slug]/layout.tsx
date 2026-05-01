import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AdminPreviewBanner } from "@/components/admin-preview-banner";
import { TenantBrandStyle } from "@/components/tenant-brand-style";
import { getAdminPreviewState } from "@/lib/site-mode";
import { getTenantConfig } from "@/lib/tenant-config";
import { getCurrentAdminContext } from "@/lib/admin-auth";

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

  // Soft-delete gate. Inactive reunions render as 404 to the public so
  // their slug effectively "disappears", but admins for that reunion (or
  // any super admin) keep access so they can flip isActive back on or
  // verify the soft-delete worked. This makes `isActive=false` a usable
  // takedown lever without losing the data.
  if (!reunion.isActive) {
    const ctx = await getCurrentAdminContext();
    const adminBypass =
      ctx && (ctx.isSuper || ctx.reunionIds.includes(reunion.id));
    if (!adminBypass) notFound();
  }

  const previewState = await getAdminPreviewState(reunion);
  const effectiveMode = previewState.effectiveMode;

  // Don't show nav on tease mode landing (it has its own design)
  const showNav = effectiveMode !== "tease";

  // Banner shows only when admin is actively previewing a mode that differs
  // from what the public sees. Otherwise no ribbon — the page renders against
  // its own background and the AdminMenu (rendered inside SiteNav or
  // TeaseLanding) is the admin's control surface.
  const showPreviewBanner =
    previewState.isAdmin &&
    previewState.previewMode !== null &&
    previewState.previewMode !== previewState.actualMode;

  return (
    <>
      <TenantBrandStyle reunion={reunion} />
      {showPreviewBanner && (
        <AdminPreviewBanner
          previewMode={previewState.previewMode!}
          actualMode={previewState.actualMode}
        />
      )}
      <div className="tenant-brand">
        {showNav && (
          <SiteNav
            slug={slug}
            orgShortName={getTenantConfig(reunion).orgShortName}
            hasCommunityServiceProject={
              getTenantConfig(reunion).hasCommunityServiceProject
            }
            siteMode={effectiveMode}
            isAdmin={previewState.isAdmin}
            previewMode={previewState.previewMode}
            actualMode={previewState.actualMode}
            showAdminMenu={previewState.isAdmin && !showPreviewBanner}
          />
        )}
        {children}
      </div>
    </>
  );
}
