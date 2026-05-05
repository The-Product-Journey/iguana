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
      <div className="mt-12 rounded-xl border border-tenant-border-soft bg-tenant-tint p-8">
        <h2 className="mb-4 text-center text-xl font-bold text-tenant-darkest">
          We Need Your Help!
        </h2>
        <p className="mb-4 text-center text-ink-muted">
          Reach out if any of these apply to you:
        </p>
        <div className="mx-auto grid max-w-lg gap-2 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <p key={reason} className="text-ink-muted">
              {reason}
            </p>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => setContactOpen(true)}
            className="rounded-full border-2 border-tenant-primary px-6 py-2 font-semibold text-tenant-primary transition hover:bg-tenant-primary hover:text-white"
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
