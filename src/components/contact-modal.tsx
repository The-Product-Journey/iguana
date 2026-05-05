"use client";

import { useState } from "react";
import posthog from "posthog-js";

const CATEGORIES = [
  { value: "volunteer", label: "I want to volunteer to help" },
  { value: "photos", label: "I have high school pictures to share" },
  { value: "entertainment", label: "I have entertainment connections" },
  { value: "classmate_passed", label: "I know of classmates who have passed" },
  { value: "other", label: "Other" },
];

export function ContactModal({
  reunionId,
  open,
  onClose,
}: {
  reunionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          name: form.get("name"),
          email: form.get("email"),
          category: form.get("category"),
          message: form.get("message"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const email = form.get("email") as string;
      const name = form.get("name") as string;
      const category = form.get("category") as string;
      posthog.identify(email, { name, email });
      posthog.capture("contact_message_sent", {
        reunion_id: reunionId,
        category,
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSent(false);
    setError("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {sent ? (
          <div className="text-center">
            <p className="mb-2 text-2xl">✓</p>
            <h3 className="mb-2 text-lg font-semibold text-ink">
              Message Sent!
            </h3>
            <p className="mb-6 text-ink-muted">
              Thanks for reaching out. The reunion committee will get back to
              you soon.
            </p>
            <button
              onClick={handleClose}
              className="rounded-lg bg-tenant-primary px-6 py-2 font-medium text-white hover:bg-tenant-primary-deep"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">
                Contact the Reunion Committee
              </h3>
              <button
                onClick={handleClose}
                className="text-ink-subtle hover:text-ink-muted"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-tenant-tint p-3 text-sm text-tenant-primary">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-1 block text-sm font-medium text-ink-muted"
                >
                  Name *
                </label>
                <input
                  id="contact-name"
                  name="name"
                  required
                  className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-1 block text-sm font-medium text-ink-muted"
                >
                  Email *
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-category"
                  className="mb-1 block text-sm font-medium text-ink-muted"
                >
                  I&apos;m reaching out because...
                </label>
                <select
                  id="contact-category"
                  name="category"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-1 block text-sm font-medium text-ink-muted"
                >
                  Message *
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={4}
                  className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-tenant-primary px-4 py-2 font-medium text-white hover:bg-tenant-primary-deep disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
