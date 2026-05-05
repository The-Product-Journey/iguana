"use client";

import { useState } from "react";

const MODES = [
  {
    value: "tease" as const,
    label: "Tease",
    description: "Landing page with interest capture + sponsor CTA only",
    color: "bg-warning/10 text-warning border-warning/30",
    requiresPayouts: false,
  },
  {
    value: "pre_register" as const,
    label: "Pre-Register",
    description: "Interest signups open, full registration not yet available",
    color: "bg-forest/10 text-forest border-forest/30",
    requiresPayouts: false,
  },
  {
    value: "open" as const,
    label: "Open",
    description: "Full registration and payment active",
    color: "bg-success/10 text-success border-success/30",
    requiresPayouts: true,
  },
];

export function SiteModeToggle({
  reunionId,
  initialMode,
  payoutsReady,
}: {
  reunionId: string;
  initialMode: string;
  /**
   * Whether Stripe Connect is configured to take payments. When false,
   * modes that require payouts (Open) are disabled with an inline
   * explanation pointing the admin at the Stripe Connect section below.
   */
  payoutsReady: boolean;
}) {
  const [mode, setMode] = useState(initialMode);
  const [loading, setLoading] = useState(false);

  async function handleChange(newMode: string) {
    if (newMode === mode) return;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/site-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId, mode: newMode }),
      });

      if (res.ok) {
        setMode(newMode);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  // The active mode's description always displays. Plus a payouts-required
  // notice when admin is hovering on Open (or has it disabled).
  const activeDescription = MODES.find((m) => m.value === mode)?.description;

  return (
    <div className="mb-6 rounded-xl border border-border-warm bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-ink">Site Mode</h3>
      <div className="flex flex-wrap gap-3">
        {MODES.map((m) => {
          const isActive = mode === m.value;
          const isBlocked = m.requiresPayouts && !payoutsReady;
          const disabled = loading || isBlocked;

          return (
            <button
              key={m.value}
              onClick={() => handleChange(m.value)}
              disabled={disabled}
              title={
                isBlocked
                  ? "Connect Stripe payouts before activating this mode"
                  : undefined
              }
              className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? m.color
                  : "border-border-warm text-ink-subtle hover:bg-bg-subtle"
              } ${
                disabled && !isActive
                  ? "cursor-not-allowed opacity-50 hover:bg-transparent"
                  : ""
              }`}
            >
              {m.label}
              {isBlocked && (
                <span className="ml-1.5 text-danger" aria-hidden="true">
                  ⚠
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ink-subtle">{activeDescription}</p>
      {!payoutsReady && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-l-4 border-danger/30 border-l-danger bg-danger/10 px-3 py-2.5 text-sm">
          <span
            className="mt-0.5 shrink-0 text-danger"
            aria-hidden="true"
          >
            ⚠
          </span>
          <div>
            <p className="font-medium text-ink">
              Open mode requires Stripe payouts.
            </p>
            <p className="mt-0.5 text-ink-muted">
              Set up payouts in the Stripe Connect section below before you
              activate Open mode — otherwise attendees won&apos;t be able to
              register or pay.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
