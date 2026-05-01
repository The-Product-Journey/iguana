import { db } from "@/lib/db";
import { memorials, reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MemorialReviewClient } from "./review-client";

export default async function MemorialReviewPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const reunion = await db
    .select({ id: reunions.id })
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
  if (!reunion) notFound();

  const memorial = await db
    .select()
    .from(memorials)
    .where(eq(memorials.reviewToken, token))
    .get();

  // Cross-tenant scope check: a review token from reunion B must not
  // resolve under reunion A's URL even if the token is valid.
  if (!memorial || memorial.reunionId !== reunion.id) notFound();

  // Only show review page when in pending_review status
  if (memorial.status !== "pending_review") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            {memorial.status === "published"
              ? "Memorial Published"
              : "Memorial Under Review"}
          </h1>
          <p className="text-gray-600">
            {memorial.status === "published"
              ? "This memorial has been published. Thank you for your contribution."
              : "This memorial is currently being reviewed by the committee. You'll receive a link to review the final entry when it's ready."}
          </p>
          <a
            href={`/${slug}/memorial`}
            className="mt-6 inline-block text-red-700 hover:text-red-800"
          >
            &larr; View memorials
          </a>
        </div>
      </div>
    );
  }

  // Parse admin draft
  const draft = memorial.adminDraft ? JSON.parse(memorial.adminDraft) : null;
  const display = draft || memorial;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          Review Memorial Entry
        </h1>
        <p className="mb-8 text-gray-600">
          The reunion committee has prepared the following memorial entry. Please
          review it and let us know if it looks good to publish.
        </p>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            {display.deceasedFirstName} {display.deceasedLastName}
          </h2>
          {display.yearOfBirth && display.yearOfDeath && (
            <p className="mt-1 text-sm text-gray-500">
              {display.yearOfBirth} – {display.yearOfDeath}
            </p>
          )}
          <p className="mt-4 text-gray-700 whitespace-pre-wrap leading-relaxed">
            {display.tributeText}
          </p>
        </div>

        <MemorialReviewClient reviewToken={token} slug={slug} />
      </div>
    </div>
  );
}
