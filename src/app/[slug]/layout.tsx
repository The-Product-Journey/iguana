import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { getEffectiveSiteMode } from "@/lib/site-mode";

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

  const effectiveMode = await getEffectiveSiteMode(reunion);

  // Don't show nav on tease mode landing (it has its own design)
  const showNav = effectiveMode !== "tease";

  return (
    <>
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
