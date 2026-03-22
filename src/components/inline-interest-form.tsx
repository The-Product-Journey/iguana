"use client";

import { useState } from "react";
import type { Event } from "@/lib/db/schema";

export function InlineInterestForm({
  reunionId,
  slug,
  events,
}: {
  reunionId: string;
  slug: string;
  events: Event[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  function toggleEvent(eventId: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          slug,
          email: form.get("email"),
          firstName: form.get("firstName") || null,
          lastName: form.get("lastName") || null,
          eventIds: selectedEvents,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          You&apos;re on the list!
        </h2>
        <p className="mb-4 text-gray-600">
          We&apos;ll reach out when registration opens. Start making your travel
          plans!
        </p>
        <a
          href={`/${slug}`}
          className="inline-block text-red-700 hover:text-red-800"
        >
          &larr; Back to event page
        </a>
      </div>
    );
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
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
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

      {events.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Which events interest you?
          </p>
          <div className="space-y-2">
            {events.map((event) => (
              <label
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event.id)}
                  onChange={() => toggleEvent(event.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="text-sm font-medium">{event.name}</div>
                  <div className="text-xs text-gray-500">
                    {event.eventDate} {event.eventTime && `· ${event.eventTime}`}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Pre-Register"}
      </button>
    </form>
  );
}
