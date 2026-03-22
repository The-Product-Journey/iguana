"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import { SPONSOR_TIER_THRESHOLD_CENTS } from "@/lib/constants";

export function SponsorForm({
  reunionId,
  slug,
}: {
  reunionId: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100);
  const tier =
    amountCents >= SPONSOR_TIER_THRESHOLD_CENTS ? "top" : "community";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (amountCents < 100) {
      setError("Minimum sponsorship is $1.00");
      setLoading(false);
      return;
    }

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    formData.set("reunionId", reunionId);
    formData.set("slug", slug);
    formData.set("amountCents", String(amountCents));
    formData.set("tier", tier);
    if (logoFile) {
      formData.set("logo", logoFile);
    }

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

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contactName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Your Name *
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div>
          <label
            htmlFor="contactEmail"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email *
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="contactPhone"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Phone
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="companyName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Company / Business Name *
          </label>
          <input
            id="companyName"
            name="companyName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div>
          <label
            htmlFor="websiteUrl"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Website
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Sponsorship amount */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Sponsorship Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-500">$</span>
          <input
            id="amount"
            type="number"
            min="1"
            step="0.01"
            required
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        {amountCents > 0 && (
          <p className="mt-2 text-sm font-medium">
            {tier === "top" ? (
              <span className="text-red-700">
                Top Sponsor — {formatCents(amountCents)}
              </span>
            ) : (
              <span className="text-gray-600">
                Community Service Sponsor — {formatCents(amountCents)}
                <span className="ml-1 text-gray-400">
                  ({formatCents(SPONSOR_TIER_THRESHOLD_CENTS)}+ for Top
                  Sponsor)
                </span>
              </span>
            )}
          </p>
        )}
      </div>

      {/* Logo upload */}
      <div>
        <label
          htmlFor="logo"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Company Logo
        </label>
        <input
          id="logo"
          type="file"
          accept="image/*"
          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-red-700 hover:file:bg-red-100"
        />
        <p className="mt-1 text-xs text-gray-400">
          JPG, PNG, or SVG. Max 2MB. Will be displayed on the sponsors page.
        </p>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Message (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="A note about your sponsorship or a message for the class"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
      >
        {loading
          ? "Redirecting to payment..."
          : amountCents > 0
            ? `Sponsor — ${formatCents(amountCents)}`
            : "Sponsor"}
      </button>
    </form>
  );
}
