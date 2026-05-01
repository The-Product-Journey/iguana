"use client";

import { useState } from "react";
import { resolveSponsorDisplayName } from "@/lib/utils";

type SponsorInitial = {
  contactName: string;
  companyName: string | null;
  displayName: string | null;
  isAnonymous: boolean | null;
  message: string | null;
  websiteUrl: string | null;
};

/**
 * Post-payment "How would you like to be credited?" form. Optional —
 * sponsor can leave it blank and accept the defaults. Submits via
 * /api/sponsor/recognition keyed by Stripe Checkout session_id.
 */
export function SponsorRecognitionForm({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: SponsorInitial;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [isAnonymous, setIsAnonymous] = useState(!!initial.isAnonymous);
  const [message, setMessage] = useState(initial.message ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Live preview uses the same resolution rules as the public page
  const preview = resolveSponsorDisplayName({
    contactName: initial.contactName,
    companyName: initial.companyName,
    displayName: displayName.trim() || null,
    isAnonymous,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/sponsor/recognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          displayName: displayName.trim() || null,
          isAnonymous,
          message: message.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save");
        setSaving(false);
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        How would you like to be credited?
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Optional. The committee will review and publish your sponsorship to the
        public sponsors page. You can leave any field blank to accept defaults.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 accent-red-700 focus:ring-red-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">
              Show me as anonymous
            </span>
            <span className="block text-xs text-gray-500">
              Hides your name, website, and logo. Shows &ldquo;Anonymous Sponsor&rdquo; on the public page.
            </span>
          </span>
        </label>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="displayName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Display name <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={initial.companyName || initial.contactName}
            disabled={isAnonymous}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave blank to use {initial.companyName ? `"${initial.companyName}"` : `"${initial.contactName}"`}
          </p>
        </div>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="websiteUrl"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Website <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://"
            disabled={isAnonymous}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your name on the sponsors page links here.
          </p>
        </div>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Tagline / message <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            disabled={isAnonymous}
            placeholder="A short note shown under your name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Preview
        </p>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-base font-bold text-gray-900">{preview}</p>
          {!isAnonymous && message.trim() && (
            <p className="mt-1 text-sm text-gray-600">{message.trim()}</p>
          )}
          {!isAnonymous && websiteUrl.trim() && (
            <p className="mt-1 text-xs text-gray-400">
              {websiteUrl.trim()}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-green-700">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
