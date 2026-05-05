"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import posthog from "posthog-js";

const FEE_PRESETS = [
  { label: "No thanks", pct: 0 },
  { label: "5%", pct: 5 },
  { label: "10%", pct: 10 },
  { label: "Custom", pct: -1 },
];

export function RsvpForm({
  reunionId,
  slug,
  feeCents,
}: {
  reunionId: string;
  slug: string;
  feeCents: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [feePreset, setFeePreset] = useState(5); // default 5%
  const [customDollars, setCustomDollars] = useState("");

  const registrationTotal = feeCents * guestCount;

  let donationCents: number;
  if (feePreset === -1) {
    donationCents = Math.round(parseFloat(customDollars || "0") * 100);
  } else {
    donationCents = Math.round(registrationTotal * (feePreset / 100));
  }

  const grandTotal = registrationTotal + donationCents;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          slug,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          phone: form.get("phone"),
          guestCount,
          dietaryNotes: form.get("dietaryNotes"),
          message: form.get("message"),
          donationCents,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const email = form.get("email") as string;
      const firstName = form.get("firstName") as string;
      const lastName = form.get("lastName") as string;
      posthog.identify(email, { name: `${firstName} ${lastName}`, email });
      posthog.capture("rsvp_checkout_initiated", {
        reunion_id: reunionId,
        slug,
        guest_count: guestCount,
        registration_total_cents: registrationTotal,
        donation_cents: donationCents,
        grand_total_cents: grandTotal,
      });
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border-warm bg-white p-8 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-ink-muted">
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-ink-muted">
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-muted">
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-ink-muted">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label htmlFor="guestCount" className="mb-1 block text-sm font-medium text-ink-muted">
          Number of Guests (including yourself) *
        </label>
        <select
          id="guestCount"
          value={guestCount}
          onChange={(e) => setGuestCount(parseInt(e.target.value))}
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"} — {formatCents(feeCents * n)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dietaryNotes" className="mb-1 block text-sm font-medium text-ink-muted">
          Dietary Restrictions
        </label>
        <input
          id="dietaryNotes"
          name="dietaryNotes"
          placeholder="e.g., vegetarian, gluten-free"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-ink-muted">
          Message for the Class
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Share what you've been up to since '96!"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      {/* Cover the fees */}
      <div className="rounded-lg border border-tenant-tint-strong bg-tenant-tint p-4">
        <p className="mb-1 text-sm font-medium text-tenant-darkest">
          Help cover processing fees?
        </p>
        <p className="mb-3 text-sm text-tenant-primary-deep">
          Payment processing costs eat into the reunion budget. Adding a little
          extra ensures 100% of your registration goes toward the event.
        </p>
        <div className="flex flex-wrap gap-2">
          {FEE_PRESETS.map((preset) => (
            <button
              key={preset.pct}
              type="button"
              onClick={() => setFeePreset(preset.pct)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                feePreset === preset.pct
                  ? "bg-tenant-primary text-white"
                  : "bg-white text-tenant-primary border border-tenant-border-soft hover:bg-tenant-tint"
              }`}
            >
              {preset.label}
              {preset.pct > 0 && (
                <span className="ml-1 text-xs opacity-75">
                  (+{formatCents(Math.round(registrationTotal * (preset.pct / 100)))})
                </span>
              )}
            </button>
          ))}
        </div>
        {feePreset === -1 && (
          <div className="relative mt-3">
            <span className="absolute left-3 top-2 text-ink-subtle">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={customDollars}
              onChange={(e) => setCustomDollars(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-tenant-border-soft py-2 pl-7 pr-3 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
            />
          </div>
        )}
      </div>

      {/* Total */}
      <div className="rounded-lg bg-bg-subtle p-4">
        <div className="flex justify-between text-sm text-ink-muted">
          <span>
            Registration ({guestCount} {guestCount === 1 ? "person" : "people"})
          </span>
          <span>{formatCents(registrationTotal)}</span>
        </div>
        {donationCents > 0 && (
          <div className="mt-1 flex justify-between text-sm text-ink-muted">
            <span>Cover fees</span>
            <span>{formatCents(donationCents)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-border-warm pt-2 text-lg font-semibold">
          <span>Total</span>
          <span>{formatCents(grandTotal)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-tenant-primary px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
      >
        {loading ? "Redirecting to payment..." : `Pay ${formatCents(grandTotal)} & RSVP`}
      </button>
    </form>
  );
}
