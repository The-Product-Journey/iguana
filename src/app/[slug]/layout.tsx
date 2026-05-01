import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AdminPreviewBanner } from "@/components/admin-preview-banner";
import { TenantBrandStyle } from "@/components/tenant-brand-style";
import { getAdminPreviewState } from "@/lib/site-mode";
import { getTenantConfig } from "@/lib/tenant-config";

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
