import Link from "next/link";
import { REFUND_POLICY_TEXT } from "@/lib/constants";

export default async function SponsorConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">🙏</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Thank You for Your Sponsorship!
        </h1>
        <p className="mb-6 text-gray-600">
          Your generous contribution helps make our 30-year reunion possible.
          Your company will be featured on our sponsors page once reviewed by
          the reunion committee.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/${slug}/sponsors`}
            className="inline-block rounded-full bg-red-700 px-6 py-2 font-semibold text-white transition hover:bg-red-800"
          >
            View Sponsors
          </Link>
          <Link
            href={`/${slug}`}
            className="text-sm text-red-700 hover:text-red-800"
          >
            &larr; Back to event page
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-400">{REFUND_POLICY_TEXT}</p>
      </div>
    </div>
  );
}
