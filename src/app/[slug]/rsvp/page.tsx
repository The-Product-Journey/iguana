import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/rsvp-form";
import { PreRegisterForm } from "@/components/pre-register-form";
import { formatCents } from "@/lib/utils";
import Link from "next/link";

export default async function RsvpPage({
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-xl px-6">
        <Link
          href={`/${slug}`}
          className="mb-6 inline-block text-sm text-red-700 hover:text-red-800"
        >
          &larr; Back to event
        </Link>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{reunion.name}</h1>
          {reunion.registrationOpen ? (
            <p className="mt-2 text-gray-600">
              Registration: {formatCents(reunion.registrationFeeCents)} per
              person
            </p>
          ) : (
            <p className="mt-2 text-gray-600">
              Pre-register to save your spot — payment will open later (
              {formatCents(reunion.registrationFeeCents)} per person)
            </p>
          )}
        </div>
        {reunion.registrationOpen ? (
          <RsvpForm
            reunionId={reunion.id}
            slug={reunion.slug}
            feeCents={reunion.registrationFeeCents}
          />
        ) : (
          <PreRegisterForm reunionId={reunion.id} slug={reunion.slug} />
        )}
      </div>
    </div>
  );
}
