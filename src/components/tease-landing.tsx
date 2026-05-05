"use client";

import { useState, useEffect } from "react";
import { InterestForm } from "@/components/interest-form";
import { AdminMenu } from "@/components/admin-menu";
import { SwitchToPublicViewPill } from "@/components/switch-to-public-view-pill";
import { useAdminModeHref } from "@/lib/use-admin-mode-href";
import type { Event } from "@/lib/db/schema";

type SiteMode = "tease" | "pre_register" | "open";

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
  isAdmin,
  showAdminMenu,
  previewMode,
  actualMode,
  customDomain,
}: {
  reunion: { id: string; slug: string; name: string; description: string | null; eventDate: string };
  events: Event[];
  isAdmin?: boolean;
  /** Render the AdminMenu (true when admin is logged in and no preview banner is showing). */
  showAdminMenu?: boolean;
  previewMode?: SiteMode | null;
  actualMode?: SiteMode;
  /** Reunion's vanity domain, if configured — passed through to AdminMenu. */
  customDomain?: string | null;
}) {
  const [showInterest, setShowInterest] = useState(false);
  const countdown = useCountdown(reunion.eventDate);
  const adminModeHref = useAdminModeHref(reunion.slug);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-tenant-primary via-tenant-primary-deep to-tenant-darkest text-white">
      {!isAdmin && (
        <a
          href={adminModeHref}
          className="absolute right-4 top-3 text-xs text-tenant-on-dark hover:text-white"
        >
          Admin Mode
        </a>
      )}
      {showAdminMenu && actualMode && (
        <div className="absolute right-4 top-3 z-30 flex items-center gap-2">
          <SwitchToPublicViewPill
            customDomain={customDomain}
            variant="dark"
          />
          <AdminMenu
            slug={reunion.slug}
            actualMode={actualMode}
            previewMode={previewMode ?? null}
            variant="dark"
          />
        </div>
      )}
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        {/* Header */}
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-tenant-on-dark">
          Save the Date
        </p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-6xl">
          {reunion.name}
        </h1>
        <p className="mb-2 text-2xl font-semibold text-tenant-on-dark">
          30 Year Reunion
        </p>
        <p className="mb-10 text-lg text-tenant-on-dark">August 28–29, 2026</p>

        {reunion.description && (
          <p className="mx-auto mb-12 max-w-xl text-lg leading-relaxed text-tenant-on-dark">
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
              <div className="mt-1 text-xs font-medium uppercase tracking-wider text-tenant-on-dark">
                {unit}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={() => setShowInterest(true)}
            className="w-full rounded-full bg-white px-8 py-3 text-lg font-semibold text-tenant-primary-deep shadow-lg transition hover:bg-tenant-tint hover:shadow-xl sm:w-auto"
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

        <p className="mt-6 text-sm text-tenant-on-dark">
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
