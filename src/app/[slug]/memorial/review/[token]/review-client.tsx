"use client";

import { useState } from "react";

export function MemorialReviewClient({
  reviewToken,
  slug,
}: {
  reviewToken: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [action, setAction] = useState<"approved" | "changes" | null>(null);
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    if (!action) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/memorial/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewToken,
          action,
          notes: action === "changes" ? notes : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border-warm bg-white p-8 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-bold text-ink">
          {action === "approved" ? "Memorial Approved" : "Feedback Submitted"}
        </h2>
        <p className="text-ink-muted">
          {action === "approved"
            ? "Thank you. The memorial will now be published."
            : "Thank you for your feedback. The committee will revise the entry."}
        </p>
        <a
          href={`/${slug}/memorial`}
          className="mt-4 inline-block text-tenant-primary hover:text-tenant-primary-deep"
        >
          View memorials
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-tenant-tint p-3 text-sm text-tenant-primary">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setAction("approved")}
          className={`flex-1 rounded-lg border-2 px-4 py-3 font-semibold transition ${
            action === "approved"
              ? "border-site-success bg-site-success-tint text-site-success"
              : "border-border-warm text-ink-muted hover:bg-tenant-tint"
          }`}
        >
          Looks Good — Publish It
        </button>
        <button
          type="button"
          onClick={() => setAction("changes")}
          className={`flex-1 rounded-lg border-2 px-4 py-3 font-semibold transition ${
            action === "changes"
              ? "border-site-warning bg-site-warning-tint text-site-warning"
              : "border-border-warm text-ink-muted hover:bg-tenant-tint"
          }`}
        >
          Request Changes
        </button>
      </div>

      {action === "changes" && (
        <div>
          <label
            htmlFor="notes"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            What would you like changed?
          </label>
          <textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Please describe what should be different..."
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      )}

      {action && (
        <button
          type="button"
          disabled={loading || (action === "changes" && !notes.trim())}
          onClick={handleSubmit}
          className="w-full rounded-lg bg-tenant-primary px-4 py-3 font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      )}
    </div>
  );
}
