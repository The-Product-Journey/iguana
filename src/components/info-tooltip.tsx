"use client";

import { useState, type ReactNode } from "react";

/**
 * Small "i" info button that reveals a popover with reference content.
 * Hover to peek; click to pin (so the user can copy text from inside).
 * Click anywhere outside the button toggles it back off — handled
 * implicitly by the hover/blur lifecycle.
 *
 * Sits well in CollapsibleCard's `headerExtra` slot or anywhere a
 * disclosure-style "for reference" affordance is useful.
 */
export function InfoTooltip({
  children,
  label = "More info",
  align = "right",
}: {
  children: ReactNode;
  label?: string;
  /** Which edge of the trigger the popover anchors to. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const visible = open || pinned;
  const alignClass = align === "left" ? "left-0" : "right-0";

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        title={label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setPinned(false);
        }}
        onClick={(e) => {
          // Pin so the user can mouse INTO the popover and select text
          // without it disappearing. Click again to unpin.
          e.preventDefault();
          setPinned((p) => !p);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-strong text-[11px] font-semibold italic text-ink-muted transition hover:border-ink-muted hover:text-ink"
      >
        i
      </button>
      {visible && (
        <div
          role="tooltip"
          className={`absolute top-full z-30 mt-2 w-72 rounded-md border border-border-warm bg-white p-3 text-xs text-ink-muted shadow-lg ${alignClass}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </span>
  );
}
