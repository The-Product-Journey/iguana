"use client";

import { useRef, useState } from "react";
import { getSponsorTier, REFUND_POLICY_TEXT } from "@/lib/constants";
import posthog from "posthog-js";

export function SponsorForm({
  reunionId,
  slug,
}: {
  reunionId: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100);
  const belowMinimum = amountDollars !== "" && amountCents > 0 && amountCents < 1000;
  const formReady = contactName.trim() !== "" && contactEmail.trim() !== "" && amountCents >= 1000;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (amountCents < 1000) {
      setError("Minimum sponsorship is $10.00");
      setLoading(false);
      return;
    }

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    formData.set("reunionId", reunionId);
    formData.set("slug", slug);
    formData.set("amountCents", String(amountCents));
    formData.set("tier", getSponsorTier(amountCents));

    try {
      const res = await fetch("/api/sponsor-checkout", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      posthog.identify(contactEmail, { name: contactName, email: contactEmail });
      posthog.capture("sponsor_checkout_initiated", {
        reunion_id: reunionId,
        slug,
        amount_cents: amountCents,
        tier: getSponsorTier(amountCents),
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
      {(error || belowMinimum) && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error || "Minimum sponsorship is $10.00"}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contactName"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Your Name *
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label
            htmlFor="contactEmail"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Email *
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="contactPhone"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Phone
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="companyName"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Company / Business Name
          </label>
          <input
            id="companyName"
            name="companyName"
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label
            htmlFor="websiteUrl"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Website
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://"
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      {/* Sponsorship amount */}
      <div>
        <label className="mb-2 block text-sm font-medium text-ink-muted">
          Sponsorship Amount *
        </label>
        <div className="grid grid-cols-5 gap-2">
          {[50, 100, 250, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setAmountDollars(amt.toFixed(2));
                setSelectedPreset(amt);
              }}
              className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                selectedPreset === amt
                  ? "border-tenant-primary bg-tenant-primary text-white"
                  : "border-border-strong bg-white text-ink-muted hover:border-tenant-border-soft hover:bg-tenant-tint"
              }`}
            >
              ${amt.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="relative mt-3 rounded-lg border border-border-strong focus-within:border-tenant-primary focus-within:ring-1 focus-within:ring-tenant-primary">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <span className="block text-lg font-semibold text-ink">$</span>
            <span className="block text-xs text-ink-subtle">USD</span>
          </div>
          <input
            ref={amountInputRef}
            id="amount"
            type="number"
            min="1"
            step="0.01"
            value={amountDollars}
            onChange={(e) => {
              setAmountDollars(e.target.value);
              const val = parseFloat(e.target.value);
              if ([50, 100, 250, 500, 1000].includes(val)) {
                setSelectedPreset(val);
              } else {
                setSelectedPreset(null);
              }
            }}
            onBlur={() => {
              const val = parseFloat(amountDollars);
              if (!isNaN(val) && val > 0) {
                setAmountDollars(val.toFixed(2));
              }
            }}
            placeholder="0.00"
            className="w-full rounded-lg bg-transparent py-5 pl-14 pr-4 text-right text-3xl font-bold text-ink focus:outline-none"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Message (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="A note about your sponsorship or a message for the class"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-ink">
        {REFUND_POLICY_TEXT}
      </div>

      <button
        type="submit"
        disabled={loading || !formReady}
        className="w-full rounded-lg bg-tenant-primary px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
      >
        {loading
          ? "Redirecting to payment..."
          : amountCents > 0
            ? `Sponsor — $${(amountCents / 100).toFixed(2)}`
            : "Sponsor"}
      </button>
    </form>
  );
}
