"use client";

import { useState, useEffect } from "react";
import { InterestForm } from "@/components/interest-form";
import type { Event } from "@/lib/db/schema";

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function calc() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    }
    setTimeLeft(calc());
    const timer = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

export function TeaseLanding({
  reunion,
  events,
}: {
  reunion: { id: string; slug: string; name: string; description: string | null; eventDate: string };
  events: Event[];
}) {
  const [showInterest, setShowInterest] = useState(false);
  const countdown = useCountdown(reunion.eventDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-800 via-red-900 to-red-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        {/* Header */}
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-red-300">
          Save the Date
        </p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-6xl">
          {reunion.name}
        </h1>
        <p className="mb-2 text-2xl font-semibold text-red-200">
          30 Year Reunion
        </p>
        <p className="mb-10 text-lg text-red-200">August 28–29, 2026</p>

        {reunion.description && (
          <p className="mx-auto mb-12 max-w-xl text-lg leading-relaxed text-red-100">
            {reunion.description}
          </p>
        )}

        {/* Countdown */}
        <div className="mb-14 flex justify-center gap-6 sm:gap-10">
          {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
            <div key={unit} className="text-center">
              <div className="text-4xl font-bold tabular-nums sm:text-5xl">
                {countdown[unit]}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-red-300">
                {unit}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={() => setShowInterest(true)}
            className="w-full rounded-full bg-white px-8 py-3 text-lg font-semibold text-red-800 shadow-lg transition hover:bg-red-50 hover:shadow-xl sm:w-auto"
          >
            I&apos;m Interested
          </button>
          <a
            href={`/${reunion.slug}/sponsor`}
            className="w-full rounded-full border-2 border-white/40 px-8 py-3 text-lg font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto"
          >
            Become a Sponsor
          </a>
        </div>

        <p className="mt-6 text-sm text-red-300">
          Registration details coming soon — sign up to be first to know.
        </p>
      </div>

      {/* Interest form modal */}
      {showInterest && (
        <InterestForm
          reunionId={reunion.id}
          slug={reunion.slug}
          events={events}
          onClose={() => setShowInterest(false)}
        />
      )}
    </div>
  );
}
