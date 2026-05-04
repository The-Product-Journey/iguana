"use client";

import { useEffect, useRef, useState } from "react";
import { LaunchIcon } from "./launch-icon";

/**
 * Resolve the canonical origin client-side. Used to show full URLs in
 * the menu (`app.gladyoumadeit.com/phhs-1996`) instead of relative paths.
 * Computed in useEffect to avoid SSR/CSR hydration mismatch — the menu
 * only renders after click anyway, so the slight delay is invisible.
 */
function useCanonicalOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

/**
 * Launch button for a reunion's public site. When the reunion has a
 * `customDomain` configured, renders a dropdown letting the admin pick
 * between the default canonical URL and the vanity URL — they sometimes
 * want to verify both work. With no customDomain, falls back to a single
 * link to the canonical URL (no dropdown overhead).
 *
 * Both URL choices open in a new tab; the user keeps their place in admin.
 */
export function LaunchSiteMenu({
  slug,
  reunionName,
  customDomain,
  iconClassName,
  triggerClassName,
}: {
  slug: string;
  reunionName: string;
  customDomain: string | null;
  iconClassName?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canonicalOrigin = useCanonicalOrigin();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const defaultPath = `/${slug}`;

  // No vanity domain — degrade to a plain link, identical to the original
  // launch icon behavior.
  if (!customDomain) {
    return (
      <a
        href={defaultPath}
        target="_blank"
        rel="noopener noreferrer"
        title="Open public site in new tab"
        aria-label={`Open ${reunionName} public site in new tab`}
        className={
          triggerClassName ??
          "inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        }
      >
        <LaunchIcon className={iconClassName} />
      </a>
    );
  }

  const vanityUrl = `https://${customDomain}`;
  const defaultUrl = canonicalOrigin
    ? `${canonicalOrigin}${defaultPath}`
    : defaultPath;
  const defaultDisplay = canonicalOrigin
    ? `${new URL(canonicalOrigin).host}${defaultPath}`
    : defaultPath;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Open public site"
        aria-label={`Open ${reunionName} public site`}
        className={
          triggerClassName ??
          "inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        }
      >
        <LaunchIcon className={iconClassName} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-72 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Open in new tab
          </div>
          <a
            href={vanityUrl}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">{customDomain}</div>
            <div className="text-xs text-gray-500">Custom domain</div>
          </a>
          <a
            href={defaultUrl}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <div className="font-medium text-gray-900">{defaultDisplay}</div>
            <div className="text-xs text-gray-500">Default URL</div>
          </a>
        </div>
      )}
    </div>
  );
}
