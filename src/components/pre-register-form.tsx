"use client";

import { useState } from "react";
import posthog from "posthog-js";

export function PreRegisterForm({
  reunionId,
  slug,
}: {
  reunionId: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [guestCount, setGuestCount] = useState(1);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/pre-register", {
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const email = form.get("email") as string;
      const firstName = form.get("firstName") as string;
      const lastName = form.get("lastName") as string;
      posthog.identify(email, { name: `${firstName} ${lastName}`, email });
      posthog.capture("pre_registration_submitted", {
        reunion_id: reunionId,
        slug,
        guest_count: guestCount,
      });
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-border-warm bg-white p-8 shadow-sm text-center">
        <div className="mb-4 text-5xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-ink">
          You&apos;re Pre-Registered!
        </h2>
        <p className="mb-4 text-ink-muted">
          We&apos;ve saved your spot. We&apos;ll reach out when full
          registration and payment opens.
        </p>
        <a
          href={`/${slug}`}
          className="inline-block text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to event page
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border-warm bg-white p-8 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-site-danger-tint p-3 text-sm text-site-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label
            htmlFor="lastName"
            className="mb-1 block text-sm font-medium text-ink-muted"
          >
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Email *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="guestCount"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Expected Number of Guests (including yourself)
        </label>
        <select
          id="guestCount"
          value={guestCount}
          onChange={(e) => setGuestCount(parseInt(e.target.value))}
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="dietaryNotes"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Dietary Restrictions
        </label>
        <input
          id="dietaryNotes"
          name="dietaryNotes"
          placeholder="e.g., vegetarian, gluten-free"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Message for the Class
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Share what you've been up to since '96!"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-tenant-primary px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
      >
        {loading ? "Saving..." : "Pre-Register"}
      </button>
    </form>
  );
}
