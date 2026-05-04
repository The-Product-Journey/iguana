import type { Metadata } from "next";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AdminPreviewBanner } from "@/components/admin-preview-banner";
import { getAdminPreviewState } from "@/lib/site-mode";

/**
 * Per-reunion metadata override. The reunion's faviconUrl (set by admin via
 * the Site Customization UI, stored on Vercel Blob) takes precedence over
 * the platform default. Returning empty `icons` would inherit from the root
 * layout, so we always return an explicit icons block — either the tenant's
 * favicon or undefined (falls through to root).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const reunion = await db
    .select({ faviconUrl: reunions.faviconUrl, name: reunions.name })
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
  if (!reunion?.faviconUrl) return {};
  return {
    icons: { icon: reunion.faviconUrl },
  };
}

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
      {showPreviewBanner && (
        <AdminPreviewBanner
          previewMode={previewState.previewMode!}
          actualMode={previewState.actualMode}
        />
      )}
      {showNav && (
        <SiteNav
          slug={slug}
          reunionName={reunion.name}
          siteMode={effectiveMode}
          isAdmin={previewState.isAdmin}
          previewMode={previewState.previewMode}
          actualMode={previewState.actualMode}
          showAdminMenu={previewState.isAdmin && !showPreviewBanner}
        />
      )}
      {children}
    </>
  );
}
