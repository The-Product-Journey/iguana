"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "bad"; reason: string };

export function CreateReunionClient() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [orgShortName, setOrgShortName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [reunionMilestoneLabel, setReunionMilestoneLabel] = useState("");
  const [firstAdminEmail, setFirstAdminEmail] = useState("");
  const [withDemoData, setWithDemoData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });

  // Debounced slug availability check. The endpoint is super-admin guarded
  // so we don't worry about leaking slug-existence to other users — only
  // about not hammering the server while the operator is mid-typing.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!slug) {
      setSlugStatus({ state: "idle" });
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSlugStatus({ state: "checking" });
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/super/reunions/check-slug?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();
        if (json.ok) {
          setSlugStatus({ state: "ok" });
        } else {
          setSlugStatus({
            state: "bad",
            reason: json.reason || "Slug is unavailable.",
          });
        }
      } catch {
        setSlugStatus({
          state: "bad",
          reason: "Couldn't check slug — try submitting anyway.",
        });
      }
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/super/reunions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          eventDate: eventDate.trim(),
          orgShortName: orgShortName.trim() || undefined,
          classYear: classYear.trim() || undefined,
          reunionMilestoneLabel: reunionMilestoneLabel.trim() || undefined,
          firstAdminEmail: firstAdminEmail.trim() || undefined,
          withDemoData,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Failed to create reunion.");
        setSubmitting(false);
        return;
      }
      if (json.warning) {
        setWarning(json.warning);
      }
      router.push(`/admin/${json.reunion.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setSubmitting(false);
    }
  }

  const slugLooksValid = slugStatus.state === "ok";
  const canSubmit =
    slug.trim().length > 0 &&
    name.trim().length > 0 &&
    eventDate.trim().length > 0 &&
    slugStatus.state !== "bad" &&
    !submitting;

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {/* Slug */}
      <div>
        <label
          htmlFor="slug"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          URL slug <span className="text-red-600">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">/</span>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            placeholder="riverside-2010"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Lowercase letters, digits, hyphens. 3–40 chars. This becomes the
          public URL: <code>/{slug || "your-slug"}</code>.
        </p>
        {slugStatus.state === "checking" && (
          <p className="mt-1 text-xs text-gray-500">Checking availability…</p>
        )}
        {slugStatus.state === "ok" && (
          <p className="mt-1 text-xs text-green-600">
            ✓ Slug is available.
          </p>
        )}
        {slugStatus.state === "bad" && (
          <p className="mt-1 text-xs text-red-600">{slugStatus.reason}</p>
        )}
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Reunion name <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Riverside High School — Class of 2010"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Shown in the public hero, page titles, and email subject lines.
        </p>
      </div>

      {/* Event date */}
      <div>
        <label
          htmlFor="eventDate"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Reunion date <span className="text-red-600">*</span>
        </label>
        <input
          id="eventDate"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Treated as the first day of a one- or two-day reunion. Demo events
          inherit this date.
        </p>
      </div>

      {/* Optional identity fields */}
      <details className="rounded-lg border border-gray-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Identity &amp; copy (optional, can edit later)
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="orgShortName"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Short brand label
            </label>
            <input
              id="orgShortName"
              type="text"
              value={orgShortName}
              onChange={(e) => setOrgShortName(e.target.value)}
              placeholder="Riverside '10"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Header label on the public site. Defaults to the reunion name.
            </p>
          </div>

          <div>
            <label
              htmlFor="classYear"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Class year
            </label>
            <input
              id="classYear"
              type="text"
              value={classYear}
              onChange={(e) => setClassYear(e.target.value)}
              placeholder="2010"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label
              htmlFor="reunionMilestoneLabel"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Reunion milestone label
            </label>
            <input
              id="reunionMilestoneLabel"
              type="text"
              value={reunionMilestoneLabel}
              onChange={(e) => setReunionMilestoneLabel(e.target.value)}
              placeholder="15 Year Reunion"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Subtitle shown under the reunion name in the hero. Stored, not
              derived — gives admins control when reality disagrees with the
              math.
            </p>
          </div>
        </div>
      </details>

      {/* First admin */}
      <div>
        <label
          htmlFor="firstAdminEmail"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          First reunion admin (optional)
        </label>
        <input
          id="firstAdminEmail"
          type="email"
          value={firstAdminEmail}
          onChange={(e) => setFirstAdminEmail(e.target.value)}
          placeholder="committee@example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Adds a row to the reunion-admin allowlist. They can sign in with
          this email and manage just this reunion. Add more admins later
          from the manage-admins page.
        </p>
      </div>

      {/* Demo data toggle */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={withDemoData}
            onChange={(e) => setWithDemoData(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium text-gray-800">
              Lay down demo data
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              Seeds 4 events, 10 sample RSVPs, 3 sponsors, 1 memorial, and 5
              interest signups so the new reunion has visible content
              immediately. Great for demos and a good baseline for the
              committee to edit. Skip this if real data&apos;s ready to go in.
            </p>
          </div>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {warning}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitting ? "Creating…" : "Create reunion"}
        </button>
        {slugLooksValid ? (
          <span className="text-xs text-gray-500">
            Will be reachable at <code>/{slug}</code>.
          </span>
        ) : null}
      </div>
    </form>
  );
}
