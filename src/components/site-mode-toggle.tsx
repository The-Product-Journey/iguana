"use client";

import { useState } from "react";

const MODES = [
  {
    value: "tease" as const,
    label: "Tease",
    description: "Landing page with interest capture + sponsor CTA only",
    color: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    value: "pre_register" as const,
    label: "Pre-Register",
    description: "Interest signups open, full registration not yet available",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "open" as const,
    label: "Open",
    description: "Full registration and payment active",
    color: "bg-green-100 text-green-800 border-green-300",
  },
];

export function SiteModeToggle({
  reunionId,
  initialMode,
}: {
  reunionId: string;
  initialMode: string;
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

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Site Mode</h3>
      <div className="flex flex-wrap gap-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => handleChange(m.value)}
            disabled={loading}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
              mode === m.value
                ? m.color
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            } disabled:opacity-50`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-500">
        {MODES.find((m) => m.value === mode)?.description}
      </p>
    </div>
  );
}
