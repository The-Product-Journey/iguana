import { db } from "@/lib/db";
import { memorials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MemorialReviewClient } from "./review-client";

export default async function MemorialReviewPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const memorial = await db
    .select()
    .from(memorials)
    .where(eq(memorials.reviewToken, token))
    .get();

  if (!memorial) notFound();

  // Only show review page when in pending_review status
  if (memorial.status !== "pending_review") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tenant-tint px-6">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-bold text-ink">
            {memorial.status === "published"
              ? "Memorial Published"
              : "Memorial Under Review"}
          </h1>
          <p className="text-ink-muted">
            {memorial.status === "published"
              ? "This memorial has been published. Thank you for your contribution."
              : "This memorial is currently being reviewed by the committee. You'll receive a link to review the final entry when it's ready."}
          </p>
          <a
            href={`/${slug}/memorial`}
            className="mt-6 inline-block text-tenant-primary hover:text-tenant-primary-deep"
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
    <div className="min-h-screen bg-tenant-tint py-12">
      <div className="mx-auto max-w-2xl px-6">
        <h1 className="mb-2 text-3xl font-bold text-ink">
          Review Memorial Entry
        </h1>
        <p className="mb-8 text-ink-muted">
          The reunion committee has prepared the following memorial entry. Please
          review it and let us know if it looks good to publish.
        </p>

        <div className="mb-8 rounded-xl border border-border-warm bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">
            {display.deceasedFirstName} {display.deceasedLastName}
          </h2>
          {display.yearOfBirth && display.yearOfDeath && (
            <p className="mt-1 text-sm text-ink-subtle">
              {display.yearOfBirth} – {display.yearOfDeath}
            </p>
          )}
          <p className="mt-4 text-ink-muted whitespace-pre-wrap leading-relaxed">
            {display.tributeText}
          </p>
        </div>

        <MemorialReviewClient reviewToken={token} slug={slug} />
      </div>
    </div>
  );
}
