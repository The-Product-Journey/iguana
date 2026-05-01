"use client";

import { useState } from "react";
import type { Event } from "@/lib/db/schema";
import { formatTentativeWhen } from "@/lib/utils";

export function InterestForm({
  reunionId,
  slug,
  events,
  onClose,
}: {
  reunionId: string;
  slug: string;
  events: Event[];
  onClose: () => void;
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
          name: form.get("name") || null,
          maidenName: form.get("maidenName") || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 text-gray-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {success ? (
          <div className="text-center">
            <div className="mb-4 text-5xl">🎉</div>
            <h2 className="mb-2 text-2xl font-bold">You&apos;re on the list!</h2>
            <p className="mb-6 text-gray-600">
              We&apos;ll reach out when registration opens. Start making your travel plans!
            </p>
            <button
              onClick={onClose}
              className="rounded-full bg-red-700 px-6 py-2 font-semibold text-white transition hover:bg-red-800"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-bold">I&apos;m Interested!</h2>
            <p className="mb-6 text-sm text-gray-600">
              Sign up to get notified when registration opens.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

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
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label htmlFor="maidenName" className="mb-1 block text-sm font-medium text-gray-700">
                  Maiden / Previous Last Name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="maidenName"
                  name="maidenName"
                  placeholder="So classmates can find you"
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
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-red-700 focus:ring-red-500"
                        />
                        <div>
                          <div className="text-sm font-medium">{event.name}</div>
                          <div className="text-xs text-gray-500">
                            {event.tentativeLabel ||
                              formatTentativeWhen(event.eventDate, event.eventTime)}
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
                {loading ? "Saving..." : "Count Me In"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
