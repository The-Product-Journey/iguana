"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import { REFUND_POLICY_TEXT } from "@/lib/constants";
import type { Event } from "@/lib/db/schema";

const FEE_PRESETS = [
  { label: "No thanks", pct: 0 },
  { label: "5%", pct: 5 },
  { label: "10%", pct: 10 },
  { label: "Custom", pct: -1 },
];

export function RegistrationForm({
  reunionId,
  slug,
  events,
  chargesEnabled = true,
}: {
  reunionId: string;
  slug: string;
  events: Event[];
  chargesEnabled?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [message, setMessage] = useState("");

  // Step 2 fields
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [payNow, setPayNow] = useState(chargesEnabled);

  // Step 2 fee coverage
  const [feePreset, setFeePreset] = useState(5);
  const [customDollars, setCustomDollars] = useState("");

  const paidEvent = events.find((e) => e.type === "paid");
  const hasPaidEvent = paidEvent && selectedEvents.includes(paidEvent.id);

  // Price logic
  const now = new Date();
  const isEarlyBird =
    paidEvent?.earlyPriceDeadline &&
    now < new Date(paidEvent.earlyPriceDeadline);
  const unitPrice = isEarlyBird
    ? paidEvent?.earlyPriceCents || paidEvent?.priceCents || 0
    : paidEvent?.priceCents || 0;
  const standardPrice = paidEvent?.priceCents || 0;
  const registrationTotal = hasPaidEvent ? unitPrice * guestCount : 0;

  let donationCents = 0;
  if (hasPaidEvent && payNow) {
    if (feePreset === -1) {
      donationCents = Math.round(parseFloat(customDollars || "0") * 100);
    } else {
      donationCents = Math.round(registrationTotal * (feePreset / 100));
    }
  }
  const grandTotal = registrationTotal + donationCents;

  function toggleEvent(eventId: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const payload = {
      reunionId,
      slug,
      firstName,
      lastName,
      email,
      phone: phone || null,
      guestCount,
      dietaryNotes: dietaryNotes || null,
      message: message || null,
      eventIds: selectedEvents,
      donationCents: hasPaidEvent && payNow ? donationCents : 0,
    };

    try {
      if (hasPaidEvent && payNow) {
        // Pay now — Stripe checkout
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong");
          setLoading(false);
          return;
        }
        window.location.href = data.url;
      } else {
        // Register without payment (or no paid event selected)
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong");
          setLoading(false);
          return;
        }
        window.location.href = `/${slug}/confirmation?token=${data.editToken}`;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step >= s
                ? "bg-red-700 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
          className="space-y-4"
        >
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Your Information
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
                  {n} {n === 1 ? "person" : "people"}
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
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
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
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share what you've been up to!"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-700 px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800"
          >
            Next — Choose Events
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Choose Your Events
          </h2>

          <div className="space-y-3">
            {events.map((event) => (
              <label
                key={event.id}
                className={`flex items-start gap-3 rounded-lg border p-4 transition cursor-pointer ${
                  selectedEvents.includes(event.id)
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-red-700 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {event.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        event.type === "paid"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {event.type === "paid"
                        ? formatCents(event.priceCents || 0)
                        : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {event.eventDate} {event.eventTime && `· ${event.eventTime}`}
                    {event.eventLocation && ` · ${event.eventLocation}`}
                  </p>
                  {event.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {event.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Payment options for paid event */}
          {hasPaidEvent && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 font-semibold text-gray-900">
                Saturday Banquet Payment
              </h3>

              {!chargesEnabled && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Online payment will be available soon. You can register now and pay at the door.
                </div>
              )}

              <div className="space-y-2">
                {chargesEnabled && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={payNow}
                      onChange={() => setPayNow(true)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        Pay now — {formatCents(unitPrice)}/person
                      </span>
                      {isEarlyBird && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Early bird saves {formatCents(standardPrice - unitPrice)}
                        </span>
                      )}
                    </div>
                  </label>
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={!payNow}
                    onChange={() => setPayNow(false)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Pay at the door — {formatCents(standardPrice)}/person
                    </span>
                  </div>
                </label>
              </div>

              {/* Fee coverage (only when paying now) */}
              {payNow && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
                  <p className="mb-1 text-sm font-medium text-red-900">
                    Help cover processing fees?
                  </p>
                  <p className="mb-3 text-sm text-red-700">
                    Adding a little extra ensures 100% of your registration goes
                    toward the event.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FEE_PRESETS.map((preset) => (
                      <button
                        key={preset.pct}
                        type="button"
                        onClick={() => setFeePreset(preset.pct)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                          feePreset === preset.pct
                            ? "bg-red-700 text-white"
                            : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
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
                      <span className="absolute left-3 top-2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customDollars}
                        onChange={(e) => setCustomDollars(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-red-200 py-2 pl-7 pr-3 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order summary */}
          {hasPaidEvent && payNow && (
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  Banquet ({guestCount}{" "}
                  {guestCount === 1 ? "person" : "people"})
                </span>
                <span>{formatCents(registrationTotal)}</span>
              </div>
              {donationCents > 0 && (
                <div className="mt-1 flex justify-between text-sm text-gray-600">
                  <span>Cover fees</span>
                  <span>{formatCents(donationCents)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
                <span>Total</span>
                <span>{formatCents(grandTotal)}</span>
              </div>
            </div>
          )}

          {hasPaidEvent && payNow && chargesEnabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-700">
              {REFUND_POLICY_TEXT}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={loading || selectedEvents.length === 0}
              onClick={handleSubmit}
              className="flex-1 rounded-lg bg-red-700 px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : hasPaidEvent && payNow
                  ? `Pay ${formatCents(grandTotal)} & Register`
                  : "Register"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
