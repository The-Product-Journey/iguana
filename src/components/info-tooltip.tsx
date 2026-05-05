"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Small "i" info button that reveals a popover with reference content.
 *
 * UX contract:
 *   - Hover (or focus) the trigger → peek the popover
 *   - Click the trigger → pin the popover open. Stays open on blur,
 *     window switch, mouse leave — until the user explicitly closes it
 *     (click trigger again or click the × inside the popover).
 *   - Mouse over the popover itself keeps it open even when not pinned,
 *     so users can move into it to copy text.
 *
 * The popover auto-flips above the trigger when there isn't enough
 * room below — measured against the viewport on hover/pin.
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

  function close() {
    setOpen(false);
    setPinned(false);
  }

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
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Pin so the popover survives hover-out, blur, and window
          // switches. Click again to unpin.
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
          className={`absolute z-30 w-72 rounded-md border border-border-warm bg-white p-3 pr-7 text-xs text-ink-muted shadow-lg ${alignClass} ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {pinned && (
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-ink-subtle hover:bg-bg-subtle hover:text-ink"
            >
              ×
            </button>
          )}
          {children}
        </div>
      )}
    </span>
  );
}
