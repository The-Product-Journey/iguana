"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SiteMode = "tease" | "pre_register" | "open";

const MODES_IN_ORDER: { value: SiteMode; label: string }[] = [
  { value: "tease", label: "Tease" },
  { value: "pre_register", label: "Pre-register" },
  { value: "open", label: "Open" },
];

/**
 * Logged-in admin's persistent menu — replaces the old "Admin login" link
 * when authed. Click to toggle a dropdown with:
 *   - Change mode: Tease / Pre-register / Open
 *     (sets the preview cookie so the admin sees that mode without
 *      changing what the public sees)
 *   - Sign out
 */
export function AdminMenu({
  actualMode,
  previewMode,
  variant = "light",
}: {
  actualMode: SiteMode;
  previewMode: SiteMode | null;
  /**
   * "light" — dark text on light backgrounds (banner / nav)
   * "dark" — light text on dark backgrounds (tease gradient)
   */
  variant?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const effectiveMode = previewMode ?? actualMode;

  // Close dropdown on outside click or Esc
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function setPreview(mode: SiteMode) {
    if (busy) return;
    setBusy(true);
    try {
      // Picking the actual mode = stop previewing (clears the cookie)
      const body = mode === actualMode ? { mode: null } : { mode };
      const res = await fetch("/api/admin/preview-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error("Preview-mode update failed", await res.json());
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      console.error("Preview-mode update threw", e);
      setBusy(false);
    }
  }

  const triggerColor =
    variant === "dark"
      ? "text-red-200 hover:text-white"
      : "text-gray-600 hover:text-gray-900";

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded text-xs font-medium ${triggerColor}`}
      >
        Admin
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Change mode
            </div>
            {MODES_IN_ORDER.map((m) => {
              const active = effectiveMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => setPreview(m.value)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-sm ${
                    active
                      ? "bg-red-50 font-medium text-red-700"
                      : "text-gray-700 hover:bg-gray-50"
                  } disabled:opacity-50`}
                >
                  <span>{m.label}</span>
                  {active && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
            <div className="my-1 border-t border-gray-100" />
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Admin panel
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
