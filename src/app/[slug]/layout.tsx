import type { Metadata } from "next";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { SiteNav } from "@/components/site-nav";
import { AdminPreviewBanner } from "@/components/admin-preview-banner";
import { getAdminPreviewState } from "@/lib/site-mode";

/**
 * Per-reunion metadata override. The reunion's faviconUrl applies ONLY when
 * the request is arriving on that reunion's customDomain — i.e. visitors
 * on the tenant's vanity URL see the tenant's branding, while visitors on
 * the canonical platform domain (app.gladyoumadeit.com/<slug>) keep seeing
 * the platform favicon. Falling through to the root layout's icons block
 * happens when this returns an empty Metadata object.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const reunion = await db
    .select({
      faviconUrl: reunions.faviconUrl,
      customDomain: reunions.customDomain,
    })
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
  if (!reunion?.faviconUrl || !reunion.customDomain) return {};
  const host = (await headers()).get("host");
  if (host !== reunion.customDomain) return {};
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

  // `data-theme="tenant"` opts this subtree out of the platform's
  // persimmon focus ring (set globally in app/globals.css). Tenant
  // forms have their own brand-red focus styles via Tailwind ring
  // utilities resolving to --color-tenant-primary.
  //
  // The tenant brand color is injected here as `--color-tenant-primary`.
  // The `tenant-primary` Tailwind token resolves to it, and CSS-derived
  // shades (deep, darkest, tint, border-soft, on-dark) auto-update.
  // Falls back to the platform default (PHHS red) when reunion.brandColor
  // is NULL — preserves visual identity for reunions that never
  // configured a brand color.
  //
  // The tenant font stack is set via inline styles to override the
  // platform's --font-sans (Bricolage Grotesque) on the public reunion
  // site. We use the same Geist + system stack the site shipped with
  // pre-rebrand so it reads as a normal consumer site, not as platform
  // chrome.
  const tenantStyle: React.CSSProperties & Record<string, string> = {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };
  if (reunion.brandColor) {
    tenantStyle["--color-tenant-primary"] = reunion.brandColor;
  }

  return (
    <div data-theme="tenant" style={tenantStyle}>
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
          customDomain={reunion.customDomain}
        />
      )}
      {children}
    </div>
  );
}
