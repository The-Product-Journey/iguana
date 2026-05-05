"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { resolveSponsorDisplayName } from "@/lib/utils";
import type { Sponsor } from "@/lib/db/schema";

/**
 * Pre-publish review dialog. Shows a live preview of the sponsor card with
 * the current display preferences and lets the admin tweak any of the
 * fields (display name, anonymous, message, website) before flipping
 * isDisplayed=true. On confirm, the admin's edits are saved AND the sponsor
 * is published in one round-trip.
 */
export function PublishSponsorDialog({
  open,
  sponsor,
  onCancel,
  onPublished,
}: {
  open: boolean;
  sponsor: Sponsor | null;
  onCancel: () => void;
  onPublished: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reset form whenever a different sponsor is selected
  useEffect(() => {
    if (sponsor) {
      setDisplayName(sponsor.displayName ?? "");
      setIsAnonymous(!!sponsor.isAnonymous);
      setMessage(sponsor.message ?? "");
      setWebsiteUrl(sponsor.websiteUrl ?? "");
      setRemoveLogo(false);
      setError("");
    }
  }, [sponsor]);

  // Esc to cancel
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !sponsor) return null;

  const previewName = resolveSponsorDisplayName({
    contactName: sponsor.contactName,
    companyName: sponsor.companyName,
    displayName: displayName.trim() || null,
    isAnonymous,
  });

  async function handleConfirm() {
    if (busy || !sponsor) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorId: sponsor.id,
          action: "publishWithEdits",
          displayName: displayName.trim() || null,
          isAnonymous,
          message: message.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          removeLogo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish");
        setBusy(false);
        return;
      }
      onPublished();
      setBusy(false);
    } catch {
      setError("Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-semibold text-ink">
          Publish sponsor?
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Review and tweak how the sponsor will appear on the public sponsors
          page. Saving will publish them.
        </p>

        {error && (
          <div className="mb-3 rounded-lg bg-cream p-2 text-sm text-forest">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border-strong accent-red-700 focus:ring-persimmon"
            />
            <span className="text-sm text-ink-muted">
              Anonymous (hides name, website, logo)
            </span>
          </label>

          <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
            <label
              htmlFor="pub-displayName"
              className="mb-1 block text-xs font-medium text-ink-muted"
            >
              Display name
            </label>
            <input
              id="pub-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={sponsor.companyName || sponsor.contactName}
              disabled={isAnonymous}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-forest-deep focus:outline-none focus:ring-1 focus:ring-persimmon"
            />
          </div>

          <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
            <label
              htmlFor="pub-website"
              className="mb-1 block text-xs font-medium text-ink-muted"
            >
              Website
            </label>
            <input
              id="pub-website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://"
              disabled={isAnonymous}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-forest-deep focus:outline-none focus:ring-1 focus:ring-persimmon"
            />
          </div>

          <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
            <label
              htmlFor="pub-message"
              className="mb-1 block text-xs font-medium text-ink-muted"
            >
              Tagline / message
            </label>
            <textarea
              id="pub-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              disabled={isAnonymous}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-forest-deep focus:outline-none focus:ring-1 focus:ring-persimmon"
            />
          </div>
        </div>

        {sponsor.logoUrl && !isAnonymous && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-ink-muted">Logo</p>
            {removeLogo ? (
              <p className="text-xs text-ink-muted">
                Logo will be removed on save.{" "}
                <button
                  type="button"
                  onClick={() => setRemoveLogo(false)}
                  className="underline-offset-2 hover:underline"
                >
                  Undo
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setRemoveLogo(true)}
                className="text-xs text-ink-subtle underline-offset-2 hover:text-ink-muted hover:underline"
              >
                Remove logo
              </button>
            )}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-border-warm bg-bg-subtle p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Preview
          </p>
          <div className="rounded border border-border-warm bg-white p-3">
            {!isAnonymous && !removeLogo && sponsor.logoUrl && (
              <div className="mb-2 flex h-16 items-center justify-center">
                <Image
                  src={sponsor.logoUrl}
                  alt={previewName}
                  width={120}
                  height={64}
                  className="max-h-16 w-auto object-contain"
                />
              </div>
            )}
            <p className="text-sm font-bold text-ink">{previewName}</p>
            {!isAnonymous && message.trim() && (
              <p className="mt-1 text-xs text-ink-muted">{message.trim()}</p>
            )}
            {!isAnonymous && websiteUrl.trim() && (
              <p className="mt-1 text-xs text-ink-subtle">{websiteUrl.trim()}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-strong bg-white px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg-subtle"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-md bg-forest px-3 py-1.5 text-sm font-medium text-white transition hover:bg-forest-deep disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Save & publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
