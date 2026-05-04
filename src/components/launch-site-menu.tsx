"use client";

import { useEffect, useRef, useState } from "react";
import { LaunchIcon } from "./launch-icon";

/**
 * Resolve the current origin client-side. The displayed URL reflects
 * whatever host the admin is currently on — `localhost:3003` in dev,
 * the Vercel preview URL on staging, the canonical app domain in prod.
 * Computed in useEffect to avoid SSR/CSR hydration mismatch.
 */
function useCurrentOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

/**
 * Launch button for a reunion's public site. Always renders as a
 * dropdown — even with a single URL — so admins always know exactly
 * what they're about to open. When a `customDomain` is configured,
 * both the vanity URL and the default URL appear so the admin can
 * verify either one.
 *
 * URLs open in a new tab; admin keeps their place in the admin panel.
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
  const currentOrigin = useCurrentOrigin();

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
  const defaultUrl = currentOrigin
    ? `${currentOrigin}${defaultPath}`
    : defaultPath;
  const defaultDisplay = currentOrigin
    ? `${new URL(currentOrigin).host}${defaultPath}`
    : defaultPath;

  const vanityUrl = customDomain ? `https://${customDomain}` : null;

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
          {vanityUrl && customDomain && (
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
          )}
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
