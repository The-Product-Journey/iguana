"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveSponsorDisplayName } from "@/lib/utils";

type SponsorInitial = {
  contactName: string;
  companyName: string | null;
  displayName: string | null;
  isAnonymous: boolean | null;
  message: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
};

/**
 * Post-payment "How would you like to be credited?" form. Optional —
 * sponsor can leave it blank and accept the defaults. Submits via
 * /api/sponsor/recognition (multipart/form-data, keyed by session_id).
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
  // Logo state: keep the existing URL until the user picks a new file or
  // explicitly removes. New file shows a local preview before save.
  const [savedLogoUrl, setSavedLogoUrl] = useState(initial.logoUrl);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(
    null
  );
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  const previewName = resolveSponsorDisplayName({
    contactName: initial.contactName,
    companyName: initial.companyName,
    displayName: displayName.trim() || null,
    isAnonymous,
  });

  // What logo URL to show in the preview right now
  const previewLogoUrl =
    !isAnonymous && !removeLogo
      ? pendingLogoPreview ?? savedLogoUrl
      : null;

  function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPendingLogoFile(null);
      setPendingLogoPreview(null);
      return;
    }
    setError("");
    setRemoveLogo(false);
    setPendingLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingLogoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearPendingLogo() {
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
  }

  function requestRemoveLogo() {
    setRemoveLogo(true);
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("displayName", displayName.trim());
      fd.set("isAnonymous", isAnonymous ? "true" : "false");
      fd.set("message", message.trim());
      fd.set("websiteUrl", websiteUrl.trim());
      if (removeLogo) {
        fd.set("removeLogo", "true");
      } else if (pendingLogoFile) {
        fd.set("logoFile", pendingLogoFile);
      }

      const res = await fetch("/api/sponsor/recognition", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save");
        setSaving(false);
        return;
      }
      // After save, fold the new state into "saved" baseline
      if (removeLogo) {
        setSavedLogoUrl(null);
      } else if (data.logoUrl) {
        setSavedLogoUrl(data.logoUrl);
      }
      setRemoveLogo(false);
      setPendingLogoFile(null);
      setPendingLogoPreview(null);
      setSavedAt(Date.now());
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const canRemove = !!(savedLogoUrl || pendingLogoPreview) && !removeLogo;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-xl border border-border-warm bg-white p-6 text-left shadow-sm"
    >
      <h2 className="mb-1 text-lg font-semibold text-ink">
        How would you like to be credited?
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        Optional. The committee will review and publish your sponsorship to the
        public sponsors page. You can leave any field blank to accept defaults.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-tenant-tint p-3 text-sm text-tenant-primary">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border-strong accent-tenant-primary focus:ring-tenant-primary"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Show me as anonymous
            </span>
            <span className="block text-xs text-ink-subtle">
              Hides your name, website, and logo. Shows &ldquo;Anonymous Sponsor&rdquo; on the public page.
            </span>
          </span>
        </label>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="displayName"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Display name <span className="text-ink-subtle">(optional)</span>
          </label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={initial.companyName || initial.contactName}
            disabled={isAnonymous}
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
          <p className="mt-1 text-xs text-ink-subtle">
            Leave blank to use {initial.companyName ? `"${initial.companyName}"` : `"${initial.contactName}"`}
          </p>
        </div>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="websiteUrl"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Website <span className="text-ink-subtle">(optional)</span>
          </label>
          <input
            id="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://"
            disabled={isAnonymous}
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Tagline / message <span className="text-ink-subtle">(optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            disabled={isAnonymous}
            placeholder="A short note shown under your name"
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>

        <div className={isAnonymous ? "pointer-events-none opacity-50" : ""}>
          <label className="mb-1 block text-sm font-medium text-ink-muted">
            Logo <span className="text-ink-subtle">(optional)</span>
          </label>
          <div className="flex items-start gap-3">
            {previewLogoUrl ? (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-border-warm bg-white p-1">
                <Image
                  src={previewLogoUrl}
                  alt="Logo preview"
                  width={96}
                  height={64}
                  className="max-h-14 w-auto object-contain"
                  unoptimized={previewLogoUrl.startsWith("data:")}
                />
              </div>
            ) : (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border-strong text-xs text-ink-subtle">
                No logo
              </div>
            )}
            <div className="flex-1">
              <input
                id="logoFile"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={onLogoSelected}
                disabled={isAnonymous}
                className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-tenant-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-tenant-primary-deep disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-ink-subtle">
                PNG, JPG, GIF, WebP, or SVG. Max 2MB.
              </p>
              <div className="mt-1 flex gap-3 text-xs">
                {pendingLogoFile && !removeLogo && (
                  <button
                    type="button"
                    onClick={clearPendingLogo}
                    className="text-ink-subtle underline-offset-2 hover:text-ink-muted hover:underline"
                  >
                    Cancel selection
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={requestRemoveLogo}
                    className="text-ink-subtle underline-offset-2 hover:text-ink-muted hover:underline"
                  >
                    Remove logo
                  </button>
                )}
                {removeLogo && (
                  <span className="text-ink-muted">
                    Logo will be removed on save.{" "}
                    <button
                      type="button"
                      onClick={() => setRemoveLogo(false)}
                      className="underline-offset-2 hover:underline"
                    >
                      Undo
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="mt-6 rounded-lg border border-border-warm bg-bg-subtle p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Preview
        </p>
        <div className="rounded border border-border-warm bg-white p-4">
          {previewLogoUrl && (
            <div className="mb-3 flex h-20 items-center justify-center">
              <Image
                src={previewLogoUrl}
                alt={previewName}
                width={160}
                height={80}
                className="max-h-20 w-auto object-contain"
                unoptimized={previewLogoUrl.startsWith("data:")}
              />
            </div>
          )}
          <p className="text-base font-bold text-ink">{previewName}</p>
          {!isAnonymous && message.trim() && (
            <p className="mt-1 text-sm text-ink-muted">{message.trim()}</p>
          )}
          {!isAnonymous && websiteUrl.trim() && (
            <p className="mt-1 text-xs text-ink-subtle">{websiteUrl.trim()}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-tenant-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-success">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
