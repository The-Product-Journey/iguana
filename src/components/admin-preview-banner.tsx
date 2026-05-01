"use client";

import Link from "next/link";
import { useState } from "react";

type SiteMode = "tease" | "pre_register" | "open";

const MODE_LABELS: Record<SiteMode, string> = {
  tease: "Tease",
  pre_register: "Pre-register",
  open: "Open",
};

export function AdminPreviewBanner({
  previewMode,
  actualMode,
}: {
  previewMode: SiteMode | null;
  actualMode: SiteMode;
}) {
  const [busy, setBusy] = useState(false);
  const effectiveMode = previewMode ?? actualMode;
  const isPreviewing = previewMode !== null;

  async function setPreview(mode: SiteMode | null) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/preview-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        console.error("Preview-mode update failed", await res.json());
        setBusy(false);
        return;
      }
      // Reload so server components re-render with the new cookie
      window.location.reload();
    } catch (e) {
      console.error("Preview-mode update threw", e);
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Admin
          </span>
          <span>
            {isPreviewing ? (
              <>
                Previewing as <strong>{MODE_LABELS[effectiveMode]}</strong> —
                public sees <strong>{MODE_LABELS[actualMode]}</strong>
              </>
            ) : (
              <>
                You&rsquo;re seeing the public view (
                <strong>{MODE_LABELS[actualMode]}</strong>)
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-amber-700">
            Preview as:
          </span>
          {(Object.keys(MODE_LABELS) as SiteMode[]).map((m) => {
            const isActive = effectiveMode === m;
            return (
              <button
                key={m}
                onClick={() => !isActive && setPreview(m)}
                disabled={busy || isActive}
                className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                  isActive
                    ? "border-amber-700 bg-amber-700 text-white"
                    : "border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                } disabled:opacity-60`}
              >
                {MODE_LABELS[m]}
              </button>
            );
          })}
          {isPreviewing && (
            <button
              onClick={() => setPreview(null)}
              disabled={busy}
              className="rounded border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
            >
              Revert to public view
            </button>
          )}

          <span className="mx-1 hidden text-amber-300 sm:inline" aria-hidden="true">|</span>

          <Link
            href="/admin"
            className="text-xs text-amber-900 underline-offset-2 hover:underline"
          >
            Admin panel
          </Link>
          <form action="/api/admin/logout" method="POST" className="leading-none">
            <button
              type="submit"
              className="text-xs text-amber-900 underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
