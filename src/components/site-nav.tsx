"use client";

import Link from "next/link";
import { useState } from "react";

type NavProps = {
  slug: string;
  reunionName: string;
  siteMode: string;
};

export function SiteNav({ slug, reunionName, siteMode }: NavProps) {
  const [open, setOpen] = useState(false);

  const links: { label: string; href: string; modes: string[] }[] = [
    { label: "Schedule", href: `/${slug}/schedule`, modes: ["pre_register", "open"] },
    { label: "Sponsors", href: `/${slug}/sponsors`, modes: ["tease", "pre_register", "open"] },
    { label: "Yearbook", href: `/${slug}/yearbook`, modes: ["pre_register", "open"] },
    { label: "Community Service", href: `/${slug}/community-service`, modes: ["pre_register", "open"] },
    { label: "Memorial", href: `/${slug}/memorial`, modes: ["pre_register", "open"] },
    { label: "Sponsor Us", href: `/${slug}/sponsor`, modes: ["tease", "pre_register", "open"] },
  ];

  const visibleLinks = links.filter((l) => l.modes.includes(siteMode));

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href={`/${slug}`}
          className="text-lg font-bold text-red-800 hover:text-red-900"
        >
          PHHS &apos;96
        </Link>

        {/* Desktop */}
        <div className="hidden gap-6 sm:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition hover:text-red-700"
            >
              {link.label}
            </Link>
          ))}
          {siteMode === "open" && (
            <Link
              href={`/${slug}/rsvp`}
              className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Register
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="sm:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-100 px-6 py-4 sm:hidden">
          <div className="flex flex-col gap-3">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-red-700"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {siteMode === "open" && (
              <Link
                href={`/${slug}/rsvp`}
                className="mt-2 rounded-full bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Register
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
