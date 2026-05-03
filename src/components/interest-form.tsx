"use client";

import { useState } from "react";
import type { Event } from "@/lib/db/schema";
import { formatTentativeWhen } from "@/lib/utils";

type Response = "yes" | "maybe" | "no";

const RESPONSE_OPTIONS: { value: Response; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No" },
];

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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [maidenName, setMaidenName] = useState("");
  const [responses, setResponses] = useState<Record<string, Response>>({});

  function setResponse(eventId: string, value: Response) {
    setResponses((prev) => ({ ...prev, [eventId]: value }));
  }

  const formReady = email.trim() !== "" && name.trim() !== "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formReady) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          slug,
          email,
          name,
          maidenName: maidenName || null,
          eventResponses: responses,
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  value={maidenName}
                  onChange={(e) => setMaidenName(e.target.value)}
                  placeholder="So classmates can find you"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {events.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Which events are you interested in?
                  </p>
                  <div className="space-y-2">
                    {events.map((event) => {
                      const current = responses[event.id];
                      return (
                        <div
                          key={event.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{event.name}</div>
                            <div className="whitespace-pre-line text-xs italic text-gray-500">
                              {event.tentativeLabel ||
                                formatTentativeWhen(event.eventDate, event.eventTime)}
                            </div>
                          </div>
                          <div
                            role="radiogroup"
                            aria-label={`${event.name} response`}
                            className="inline-flex shrink-0 overflow-hidden rounded-md border border-gray-300"
                          >
                            {RESPONSE_OPTIONS.map((opt) => {
                              const active = current === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => setResponse(event.id, opt.value)}
                                  className={`px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-red-500 ${
                                    active
                                      ? "bg-red-700 text-white"
                                      : "bg-white text-gray-700 hover:bg-gray-50"
                                  } ${opt.value !== "yes" ? "border-l border-gray-300" : ""}`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !formReady}
                className="w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white shadow transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Saving..." : "Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
