"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const FAVICON_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
const FAVICON_MAX_SIZE = 1 * 1024 * 1024; // 1MB
const FAVICON_MIN_DIM = 32;

/**
 * Per-reunion site customization: vanity domain + favicon.
 *
 * Two independent forms in one card so admins can update either without
 * touching the other. Domain has live format validation; favicon does
 * client-side image validation (square + minimum 32×32 + format + size)
 * before uploading. Final upload + persistence go through
 * /api/admin/reunion-customization.
 */
export function SiteCustomization({
  reunionId,
  initialCustomDomain,
  initialFaviconUrl,
  initialBrandColor,
}: {
  reunionId: string;
  initialCustomDomain: string | null;
  initialFaviconUrl: string | null;
  initialBrandColor: string | null;
}) {
  // Outer card chrome is provided by the CollapsibleCard wrapper in the
  // parent admin page. This component renders just the body content.
  return (
    <div className="space-y-6">
      <DomainSection
        reunionId={reunionId}
        initialValue={initialCustomDomain}
      />
      <div className="border-t border-border-warm" />
      <FaviconSection
        reunionId={reunionId}
        initialUrl={initialFaviconUrl}
      />
      <div className="border-t border-border-warm" />
      <BrandColorSection
        reunionId={reunionId}
        initialValue={initialBrandColor}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom domain
// ---------------------------------------------------------------------------

function DomainSection({
  reunionId,
  initialValue,
}: {
  reunionId: string;
  initialValue: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trimmed = value.trim().toLowerCase();
  const formatValid = trimmed === "" || HOSTNAME_RE.test(trimmed);
  const dirty = trimmed !== (initialValue ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!formatValid || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("customDomain", trimmed);
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <label className="block text-sm font-semibold text-ink-muted">
        Custom domain
      </label>
      <p className="mt-1 mb-2 text-xs text-ink-subtle">
        Optional. The public-facing domain for this reunion. Enter the
        hostname only — for example{" "}
        <code className="rounded bg-bg-subtle px-1 py-0.5 text-[11px]">
          www.yourdomain.com
        </code>
        . Leave blank to use the default URL.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="www.yourdomain.com"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            className={`rounded-lg border px-3 py-2 text-sm ${
              !formatValid && trimmed !== ""
                ? "border-cream focus:border-forest-deep"
                : "border-border-strong"
            }`}
          />
          {!formatValid && trimmed !== "" && (
            <p className="mt-1 text-xs text-danger">
              Not a valid hostname. Don&apos;t include{" "}
              <code className="rounded bg-cream px-1">https://</code>, paths,
              or ports.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !dirty || !formatValid}
          className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save domain"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {success && (
        <p className="mt-2 text-sm text-green-700">
          Saved. Some manual setup is required before the new domain serves
          traffic.
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Favicon
// ---------------------------------------------------------------------------

function FaviconSection({
  reunionId,
  initialUrl,
}: {
  reunionId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function validate(file: File): Promise<string | null> {
    if (!FAVICON_TYPES.includes(file.type)) {
      return "Use SVG, PNG, or ICO.";
    }
    if (file.size > FAVICON_MAX_SIZE) {
      return "File too large — keep it under 1 MB.";
    }
    // SVG and ICO: skip dimension checks. SVG scales freely; ICO is a
    // multi-image container browsers handle on their own.
    if (file.type === "image/png") {
      const dims = await readImageDimensions(file).catch(() => null);
      if (!dims) return "Couldn't read image. Try a different file.";
      if (dims.width !== dims.height) {
        return `Favicon must be square. This one is ${dims.width}×${dims.height}.`;
      }
      if (dims.width < FAVICON_MIN_DIM) {
        return `Favicon must be at least ${FAVICON_MIN_DIM}×${FAVICON_MIN_DIM} (this is ${dims.width}×${dims.width}).`;
      }
    }
    return null;
  }

  async function onFileSelected(file: File | null) {
    setError(null);
    if (!file) {
      setPendingFile(null);
      setPendingDataUrl(null);
      return;
    }
    const err = await validate(file);
    if (err) {
      setError(err);
      setPendingFile(null);
      setPendingDataUrl(null);
      return;
    }
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setPendingDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function upload() {
    if (!pendingFile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("faviconFile", pendingFile);
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setPreviewUrl(j.faviconUrl ?? pendingDataUrl);
        setPendingFile(null);
        setPendingDataUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearFavicon() {
    if (!confirm("Remove this favicon? The default platform favicon will be used.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("clearFavicon", "true");
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        setPreviewUrl(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const displayUrl = pendingDataUrl ?? previewUrl;

  return (
    <div>
      <label className="block text-sm font-semibold text-ink-muted">
        Favicon
      </label>
      <p className="mt-1 mb-3 text-xs text-ink-subtle">
        Optional. Square image that browsers show in the tab. SVG, PNG, or ICO,
        at least 32×32, under 1 MB.
      </p>

      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-warm bg-bg-subtle">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- vercel blob URLs vary; <Image> needs whitelist config
            <img
              src={displayUrl}
              alt="Favicon preview"
              className="max-h-full max-w-full"
            />
          ) : (
            <span className="text-[10px] text-ink-subtle">No favicon</span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.ico,image/svg+xml,image/png,image/x-icon,image/vnd.microsoft.icon"
            disabled={busy}
            onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
            className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-bg-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-muted hover:file:bg-gray-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !pendingFile}
              onClick={upload}
              className="rounded-lg bg-forest px-4 py-1.5 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload favicon"}
            </button>
            {previewUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={clearFavicon}
                className="text-sm text-forest hover:text-forest-deep disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand color
// ---------------------------------------------------------------------------

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const PLATFORM_DEFAULT_BRAND = "#475569"; // Slate — matches the @theme fallback in globals.css

function BrandColorSection({
  reunionId,
  initialValue,
}: {
  reunionId: string;
  initialValue: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    initialValue ?? PLATFORM_DEFAULT_BRAND
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trimmed = value.trim().toUpperCase();
  const formatValid = HEX_COLOR_RE.test(trimmed);
  const dirty =
    trimmed !==
    (initialValue?.toUpperCase() ?? PLATFORM_DEFAULT_BRAND.toUpperCase());

  // Compute contrast ratio against white (the public reunion site's
  // primary background) so we can warn admins about hard-to-read colors.
  // Returns null when the input isn't a valid hex.
  const contrastVsWhite = formatValid ? contrastRatio(trimmed, "#FFFFFF") : null;
  const lowContrast =
    contrastVsWhite !== null && contrastVsWhite < 4.5;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!formatValid || !dirty || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("brandColor", trimmed);
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const fd = new FormData();
      fd.set("reunionId", reunionId);
      fd.set("brandColor", "");
      const res = await fetch("/api/admin/reunion-customization", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        setValue(PLATFORM_DEFAULT_BRAND);
        setSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <label className="block text-sm font-semibold text-ink">
        Brand color
      </label>
      <p className="mt-1 mb-3 text-xs text-ink-subtle">
        Primary color for the public reunion site (buttons, links, accents).
        Lighter and darker shades derive automatically.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-white px-2 py-1">
          <input
            type="color"
            value={formatValid ? trimmed : PLATFORM_DEFAULT_BRAND}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            disabled={busy}
            aria-label="Pick brand color"
            className="h-7 w-10 cursor-pointer rounded border-0 p-0"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="#B91C1C"
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
            className="w-24 border-0 bg-transparent font-mono text-sm focus:outline-none"
          />
        </div>

        {/* Live preview swatches showing how the color reads as primary
            text and as a button background — the two main usage modes. */}
        <div className="flex items-center gap-3 rounded-lg border border-border-warm bg-white px-3 py-2">
          {formatValid && (
            <>
              <span
                className="text-sm font-semibold"
                style={{ color: trimmed }}
              >
                Sample link
              </span>
              <span
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: trimmed }}
              >
                Sample button
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex gap-2">
          {initialValue && (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-sm text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Reset to default
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !dirty || !formatValid}
            className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-on-forest hover:bg-forest-deep disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save color"}
          </button>
        </div>
      </div>
      {!formatValid && value !== "" && (
        <p className="mt-2 text-xs text-danger">
          Use a 6-digit hex value, like <code>#B91C1C</code>.
        </p>
      )}
      {formatValid && lowContrast && (
        <p className="mt-2 text-xs text-warning">
          ⚠ This color may be hard to read on white backgrounds (contrast
          ratio {contrastVsWhite!.toFixed(1)}:1, below WCAG AA 4.5:1).
          Visitors may have trouble seeing buttons and links. You can save
          anyway if it&apos;s your brand.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {success && (
        <p className="mt-2 text-sm text-success">
          Brand color saved. Public reunion pages will refresh on their
          next load.
        </p>
      )}
    </form>
  );
}

/**
 * WCAG-style relative luminance per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * Hex parser is intentionally minimal — assumes 6-digit hex with a leading "#".
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
