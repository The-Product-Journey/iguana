"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";

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
  const [donationDollars, setDonationDollars] = useState("");

  const registrationTotal = feeCents * guestCount;
  const donationCents = Math.round(parseFloat(donationDollars || "0") * 100);
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
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label htmlFor="guestCount" className="mb-1 block text-sm font-medium text-gray-700">
          Number of Guests (including yourself) *
        </label>
        <select
          id="guestCount"
          value={guestCount}
          onChange={(e) => setGuestCount(parseInt(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"} — {formatCents(feeCents * n)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dietaryNotes" className="mb-1 block text-sm font-medium text-gray-700">
          Dietary Restrictions
        </label>
        <input
          id="dietaryNotes"
          name="dietaryNotes"
          placeholder="e.g., vegetarian, gluten-free"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-gray-700">
          Message for the Class
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Share what you've been up to since '96!"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {/* Donation */}
      <div className="rounded-lg border border-red-100 bg-red-50 p-4">
        <label htmlFor="donation" className="mb-1 block text-sm font-medium text-red-900">
          Optional Donation
        </label>
        <p className="mb-3 text-sm text-red-700">
          Help us cover costs and make the reunion even better for all Trojans!
        </p>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            id="donation"
            type="number"
            min="0"
            step="1"
            value={donationDollars}
            onChange={(e) => setDonationDollars(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-red-200 py-2 pl-7 pr-3 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Total */}
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Registration ({guestCount} {guestCount === 1 ? "person" : "people"})
          </span>
          <span>{formatCents(registrationTotal)}</span>
        </div>
        {donationCents > 0 && (
          <div className="mt-1 flex justify-between text-sm text-gray-600">
            <span>Donation</span>
            <span>{formatCents(donationCents)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
          <span>Total</span>
          <span>{formatCents(grandTotal)}</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
      >
        {loading ? "Redirecting to payment..." : `Pay ${formatCents(grandTotal)} & RSVP`}
      </button>
    </form>
  );
}
