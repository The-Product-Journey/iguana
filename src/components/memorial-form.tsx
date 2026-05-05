"use client";

import { useState } from "react";

export function MemorialForm({
  reunionId,
  slug,
}: {
  reunionId: string;
  slug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("reunionId", reunionId);
    if (photoFile) {
      formData.set("photo", photoFile);
    }

    try {
      const res = await fetch("/api/memorial", {
        method: "POST",
        body: formData,
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
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Thank You
        </h2>
        <p className="mb-4 text-gray-600">
          Your memorial submission has been received. The reunion committee will
          review it carefully and may reach out to you with any questions.
        </p>
        <a
          href={`/${slug}/memorial`}
          className="inline-block text-tenant-primary hover:text-tenant-primary-deep"
        >
          &larr; Back to memorials
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
        <div className="rounded-lg bg-tenant-tint p-3 text-sm text-tenant-primary">
          {error}
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">
        About the Classmate
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deceasedFirstName" className="mb-1 block text-sm font-medium text-gray-700">
            First Name *
          </label>
          <input
            id="deceasedFirstName"
            name="deceasedFirstName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label htmlFor="deceasedLastName" className="mb-1 block text-sm font-medium text-gray-700">
            Last Name *
          </label>
          <input
            id="deceasedLastName"
            name="deceasedLastName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="yearOfBirth" className="mb-1 block text-sm font-medium text-gray-700">
            Year of Birth
          </label>
          <input
            id="yearOfBirth"
            name="yearOfBirth"
            placeholder="e.g., 1978"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label htmlFor="yearOfDeath" className="mb-1 block text-sm font-medium text-gray-700">
            Year of Death
          </label>
          <input
            id="yearOfDeath"
            name="yearOfDeath"
            placeholder="e.g., 2023"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Photo
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-tenant-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tenant-primary hover:file:bg-tenant-tint-strong"
        />
      </div>

      <div>
        <label htmlFor="tributeText" className="mb-1 block text-sm font-medium text-gray-700">
          Tribute / Remembrance *
        </label>
        <textarea
          id="tributeText"
          name="tributeText"
          required
          rows={5}
          placeholder="Share your memories and what this person meant to the class..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <hr className="border-gray-200" />

      <h3 className="text-lg font-semibold text-gray-900">
        Your Contact Information
      </h3>
      <p className="text-sm text-gray-500">
        For committee use only — we may reach out with questions.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="submitterName" className="mb-1 block text-sm font-medium text-gray-700">
            Your Name *
          </label>
          <input
            id="submitterName"
            name="submitterName"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label htmlFor="submitterEmail" className="mb-1 block text-sm font-medium text-gray-700">
            Your Email *
          </label>
          <input
            id="submitterEmail"
            name="submitterEmail"
            type="email"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="submitterPhone" className="mb-1 block text-sm font-medium text-gray-700">
            Your Phone
          </label>
          <input
            id="submitterPhone"
            name="submitterPhone"
            type="tel"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
        <div>
          <label htmlFor="submitterRelationship" className="mb-1 block text-sm font-medium text-gray-700">
            Relationship
          </label>
          <input
            id="submitterRelationship"
            name="submitterRelationship"
            placeholder="e.g., classmate, family member, friend"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-tenant-primary px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Memorial"}
      </button>
    </form>
  );
}
