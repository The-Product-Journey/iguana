import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantConfig } from "@/lib/tenant-config";

export default async function CommunityServicePage({
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

  const tenantConfig = getTenantConfig(reunion);

  // Tenants without a configured community-service project don't expose
  // this page. The homepage block (in [slug]/page.tsx) is also gated on
  // the same flag, so the only way to reach here without a configured
  // project is by typing the URL directly.
  if (!tenantConfig.hasCommunityServiceProject) notFound();

  const projectName = tenantConfig.communityServiceProjectName!;
  const charityName = tenantConfig.communityServiceCharityName;
  const fullCopy = tenantConfig.communityServiceFullCopy;
  const wishlistUrl = process.env.NEXT_PUBLIC_AMAZON_WISHLIST_URL;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Community Service Project: {projectName}
          </h1>
          <p className="text-gray-600">
            Saturday morning, we&apos;re giving back to the community.
          </p>
        </div>

        {fullCopy && (
          <div className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            {fullCopy.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-gray-700 whitespace-pre-line">
                {para}
              </p>
            ))}
            {charityName && !fullCopy.includes(charityName) && (
              <p className="text-gray-700">
                We&apos;re partnering with <strong>{charityName}</strong>.
              </p>
            )}
          </div>
        )}

        <div className="mb-8 rounded-xl border-2 border-red-200 bg-red-50 p-6">
          <h2 className="mb-3 text-lg font-bold text-red-900">
            Donate Items via Amazon Wish List
          </h2>
          <p className="mb-4 text-sm text-red-800">
            Help fill the project. Buy a few items off the list and Amazon
            ships them straight to us.
          </p>
          {wishlistUrl ? (
            <a
              href={wishlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-red-700 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-800"
            >
              Donate items via Amazon Wish List &rarr;
            </a>
          ) : (
            <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
              Wish list coming soon — check back!
            </p>
          )}
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <p>
            <strong>Tax receipts:</strong> Tax receipt eligibility for
            charitable contributions and donated items is being confirmed with
            our partner charity. We&apos;ll update this page once we have
            details.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-3 text-gray-700">
            Want to sponsor the project directly?
          </p>
          <Link
            href={`/${slug}/sponsor`}
            className="inline-block rounded-full bg-red-700 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-800"
          >
            Become a {tenantConfig.sponsorCommunityTierLabel} Sponsor
          </Link>
        </div>
      </div>
    </div>
  );
}
