"use client";

import { useState } from "react";

type ProfileData = {
  currentCity: string | null;
  occupation: string | null;
  family: string | null;
  favoriteSchoolMemory: string | null;
  // Legacy column — kept for backward-compat reads while the column-rename
  // copy-then-drop is in flight.
  favoritePHMemory: string | null;
  beenUpTo: string | null;
  funFact: string | null;
  photoUrl: string | null;
};

export function ProfileForm({
  rsvpId,
  editToken,
  existingProfile,
  favoriteMemoryLabel,
}: {
  rsvpId: string;
  editToken: string;
  existingProfile: ProfileData | null;
  /** Tenant-config label, e.g. "Favorite Park Hill Memory" or just
   * "Favorite School Memory" — see getTenantConfig(). */
  favoriteMemoryLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    existingProfile?.photoUrl || null
  );

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("rsvpId", rsvpId);
    formData.set("editToken", editToken);
    if (photoFile) {
      formData.set("photo", photoFile);
    }

    try {
      const res = await fetch("/api/profile", {
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
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Profile saved!
        </div>
      )}

      {/* Photo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Photo
        </label>
        {photoPreview && (
          <div className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Profile preview"
              className="h-32 w-32 rounded-full object-cover"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-red-700 hover:file:bg-red-100"
        />
      </div>

      <div>
        <label
          htmlFor="currentCity"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Where do you live now?
        </label>
        <input
          id="currentCity"
          name="currentCity"
          defaultValue={existingProfile?.currentCity || ""}
          placeholder="e.g., Denver, CO"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="occupation"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          What do you do?
        </label>
        <input
          id="occupation"
          name="occupation"
          defaultValue={existingProfile?.occupation || ""}
          placeholder="e.g., Software engineer at Acme Corp"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="family"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Family
        </label>
        <textarea
          id="family"
          name="family"
          rows={2}
          defaultValue={existingProfile?.family || ""}
          placeholder="e.g., Married with 2 kids, a dog named Barkley..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="favoriteSchoolMemory"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {favoriteMemoryLabel}
        </label>
        <textarea
          id="favoriteSchoolMemory"
          name="favoriteSchoolMemory"
          rows={3}
          defaultValue={
            existingProfile?.favoriteSchoolMemory ??
            existingProfile?.favoritePHMemory ??
            ""
          }
          placeholder="That time in Mr. Johnson's class when..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="beenUpTo"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          What have you been up to?
        </label>
        <textarea
          id="beenUpTo"
          name="beenUpTo"
          rows={4}
          defaultValue={existingProfile?.beenUpTo || ""}
          placeholder="The highlights of the last 30 years..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <div>
        <label
          htmlFor="funFact"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Fun Fact About You
        </label>
        <input
          id="funFact"
          name="funFact"
          defaultValue={existingProfile?.funFact || ""}
          placeholder="e.g., I've visited 47 states, I can juggle flaming torches..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-700 px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
