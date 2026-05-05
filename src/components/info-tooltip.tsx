"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Small "i" info button that reveals a popover with reference content.
 * Hover to peek; click to pin (so the user can mouse into the popover
 * and copy text from inside).
 *
 * The popover auto-flips above the trigger when there isn't enough
 * room below — measured against the viewport on hover/pin.
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
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visible = open || pinned;
  const alignClass = align === "left" ? "left-0" : "right-0";

  useEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const ESTIMATED_HEIGHT = 200;
    if (spaceBelow < ESTIMATED_HEIGHT && spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, [visible]);

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
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
          className={`absolute z-30 w-72 rounded-md border border-border-warm bg-white p-3 text-xs text-ink-muted shadow-lg ${alignClass} ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </span>
  );
}
