"use client";

import { useState, type ReactNode } from "react";

type Emphasis = "default" | "warning";

/**
 * Collapsible card used to organize the per-reunion admin page. Each
 * section (Site Customization, Stripe Connect, etc.) gets one of these.
 *
 * Smart defaults:
 *   - `defaultOpen` controls the initial state. Pass `true` for sections
 *     that need attention (no domain configured, etc.) so the admin's
 *     eye lands on them; pass `false` for healthy sections so the page
 *     stays scannable.
 *   - When `emphasis="warning"`, the card shows a warning-colored left
 *     border and cream tint, and is forced open (`collapsible` ignored).
 *     Use for sections the admin must address (Stripe not connected
 *     when the reunion is taking payments, etc.).
 *
 * No persistence — collapse state resets on every page load. That's
 * desirable: a section that lapses (Stripe disconnects) re-emphasizes
 * itself the next time the admin loads the page.
 */
export function CollapsibleCard({
  title,
  subtitle,
  defaultOpen = false,
  emphasis = "default",
  collapsible = true,
  headerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  emphasis?: Emphasis;
  collapsible?: boolean;
  /** Optional extra content (e.g. a status pill or refresh button) shown next to the title. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  // Warning emphasis forces the card open — admin needs to see + act on
  // whatever's inside.
  const isCollapsible = collapsible && emphasis !== "warning";
  const [open, setOpen] = useState(emphasis === "warning" ? true : defaultOpen);

  const wrapperClass =
    emphasis === "warning"
      ? "mb-6 overflow-hidden rounded-xl border border-border-warm bg-bg-subtle shadow-sm border-l-4 border-l-warning"
      : "mb-6 overflow-hidden rounded-xl border border-border-warm bg-white shadow-sm";

  return (
    <section className={wrapperClass}>
      <header
        className={`flex items-center gap-3 px-5 py-4 ${
          isCollapsible
            ? "cursor-pointer select-none"
            : ""
        }`}
        onClick={isCollapsible ? () => setOpen(!open) : undefined}
        role={isCollapsible ? "button" : undefined}
        aria-expanded={isCollapsible ? open : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={
          isCollapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(!open);
                }
              }
            : undefined
        }
      >
        <div className="flex-1 min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            {emphasis === "warning" && (
              <span className="text-warning" aria-hidden="true">
                ⚠
              </span>
            )}
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
          )}
        </div>
        {headerExtra && (
          <div onClick={(e) => e.stopPropagation()}>{headerExtra}</div>
        )}
        {isCollapsible && (
          <span
            className={`text-ink-subtle transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
      </header>
      {open && (
        <div className="border-t border-border-warm bg-white px-5 py-4">
          {children}
        </div>
      )}
    </section>
  );
}
