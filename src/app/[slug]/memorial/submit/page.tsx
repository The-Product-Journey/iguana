import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getEffectiveSiteMode } from "@/lib/site-mode";
import { MemorialForm } from "@/components/memorial-form";

export default async function MemorialSubmitPage({
  params,
}: {
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
  if (effectiveMode === "tease") redirect(`/${slug}`);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}/memorial`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to memorials
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Submit a Memorial
          </h1>
          <p className="text-gray-600">
            Help us remember a classmate who is no longer with us. All
            submissions are reviewed by the reunion committee before being
            published.
          </p>
        </div>

        <MemorialForm reunionId={reunion.id} slug={slug} />
      </div>
    </div>
  );
}
