"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline-editable site name. Click the pencil to switch into an input,
 * Enter or Save to commit, Esc or Cancel to discard. Persists to
 * /api/admin/reunion-customization (the existing endpoint that also
 * handles favicon, domain, brand color).
 */
export function EditableSiteName({
  reunionId,
  initialName,
}: {
  reunionId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const formatValid = trimmed.length >= 2 && trimmed.length <= 100;
  const dirty = trimmed !== initialName;

  async function save() {
    if (!formatValid || !dirty || busy) {
      // No-op save (no change or invalid) just exits edit mode.
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("name", trimmed);
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setValue(initialName);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h2 className="text-2xl font-bold">{initialName}</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit site name"
          title="Edit site name"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-subtle transition hover:bg-bg-subtle hover:text-ink-muted"
        >
          <PencilIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          maxLength={100}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          className="rounded-lg border border-border-strong px-3 py-1.5 text-2xl font-bold focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !formatValid || !dirty}
          className="rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white transition hover:bg-forest-deep disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="rounded-lg border border-border-strong bg-white px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!formatValid && trimmed !== "" && !error && (
        <p className="text-xs text-ink-muted">
          Name must be 2–100 characters.
        </p>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
