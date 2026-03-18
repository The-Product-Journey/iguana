"use client";

import { useState } from "react";
import { ContactModal } from "./contact-modal";

const REASONS = [
  "Want to volunteer to help",
  "Have high school pictures to share",
  "Have entertainment connections",
  "Know of classmates who have passed",
];

export function HelpSection({ reunionId }: { reunionId: string }) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <div className="mt-12 rounded-xl border border-red-200 bg-red-50 p-8">
        <h2 className="mb-4 text-center text-xl font-bold text-red-900">
          We Need Your Help!
        </h2>
        <p className="mb-4 text-center text-gray-700">
          Reach out if any of these apply to you:
        </p>
        <div className="mx-auto grid max-w-lg gap-2 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <p key={reason} className="text-gray-700">
              {reason}
            </p>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => setContactOpen(true)}
            className="rounded-full border-2 border-red-700 px-6 py-2 font-semibold text-red-700 transition hover:bg-red-700 hover:text-white"
          >
            Contact the Committee
          </button>
        </div>
      </div>

      <ContactModal
        reunionId={reunionId}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </>
  );
}
