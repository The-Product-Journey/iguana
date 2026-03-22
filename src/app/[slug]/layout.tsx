import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/site-nav";

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

  // Don't show nav on tease mode landing (it has its own design)
  const showNav = reunion.siteMode !== "tease";

  return (
    <>
      {showNav && (
        <SiteNav
          slug={slug}
          reunionName={reunion.name}
          siteMode={reunion.siteMode}
        />
      )}
      {children}
    </>
  );
}
