"use client";

import { useState } from "react";

export function RegistrationToggle({
  reunionId,
  initialOpen,
}: {
  reunionId: string;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const newValue = !open;

    const res = await fetch("/api/admin/toggle-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reunionId, registrationOpen: newValue }),
    });

    if (res.ok) {
      setOpen(newValue);
    }
    setLoading(false);
  }

  return (
    <div className="mb-8 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex-1">
        <p className="font-medium text-gray-900">Registration Mode</p>
        <p className="text-sm text-gray-500">
          {open
            ? "Full registration is active — attendees pay when they sign up."
            : "Pre-registration only — attendees reserve a spot without payment."}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
          open
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
        }`}
      >
        {loading
          ? "..."
          : open
            ? "Registration Open"
            : "Pre-Registration Only"}
      </button>
    </div>
  );
}
