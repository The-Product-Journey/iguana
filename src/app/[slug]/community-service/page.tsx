import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

const PROJECT_NAME = "96 Backpacks";

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

  const wishlistUrl = process.env.NEXT_PUBLIC_AMAZON_WISHLIST_URL;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Community Service Project: {PROJECT_NAME}
          </h1>
          <p className="text-gray-600">
            Saturday morning, we&apos;re giving back to the Park Hill community
            that shaped us.
          </p>
        </div>

        <div className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-700">
            On Saturday morning of reunion weekend, we&apos;re assembling{" "}
            <strong>96 backpacks</strong> filled with school supplies for Park
            Hill students. It&apos;s a hands-on way to start the day together
            and leave the community a little better than we found it.
          </p>
          <p className="text-gray-700">
            We&apos;re partnering with{" "}
            <strong>Replenish KC</strong>, who will deliver the filled backpacks
            to Park Hill schools.
          </p>
        </div>

        <div className="mb-8 rounded-xl border-2 border-tenant-border-soft bg-tenant-tint p-6">
          <h2 className="mb-3 text-lg font-bold text-tenant-darkest">
            Donate Items via Amazon Wish List
          </h2>
          <p className="mb-4 text-sm text-tenant-primary-deep">
            Help fill the backpacks. Buy a few items off the list and Amazon
            ships them straight to us.
          </p>
          {wishlistUrl ? (
            <a
              href={wishlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-tenant-primary px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-tenant-primary-deep"
            >
              Donate items via Amazon Wish List &rarr;
            </a>
          ) : (
            <p className="rounded-md border border-tenant-border-soft bg-white px-3 py-2 text-sm text-tenant-primary">
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
            className="inline-block rounded-full bg-tenant-primary px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-tenant-primary-deep"
          >
            Become a Community Service Project Sponsor
          </Link>
        </div>
      </div>
    </div>
  );
}
