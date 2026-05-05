"use client";

import { useState } from "react";
import posthog from "posthog-js";

type ProfileData = {
  currentCity: string | null;
  occupation: string | null;
  family: string | null;
  favoritePHMemory: string | null;
  beenUpTo: string | null;
  funFact: string | null;
  photoUrl: string | null;
};

export function ProfileForm({
  rsvpId,
  editToken,
  existingProfile,
}: {
  rsvpId: string;
  editToken: string;
  existingProfile: ProfileData | null;
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

      posthog.capture("yearbook_profile_saved", {
        rsvp_id: rsvpId,
        has_photo: !!photoFile,
        is_update: !!existingProfile,
      });
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
      className="space-y-6 rounded-xl border border-border-warm bg-white p-8 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
          Profile saved!
        </div>
      )}

      {/* Photo */}
      <div>
        <label className="mb-1 block text-sm font-medium text-ink-muted">
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
          className="w-full text-sm text-ink-subtle file:mr-4 file:rounded-full file:border-0 file:bg-tenant-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tenant-primary hover:file:bg-tenant-tint-strong"
        />
      </div>

      <div>
        <label
          htmlFor="currentCity"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Where do you live now?
        </label>
        <input
          id="currentCity"
          name="currentCity"
          defaultValue={existingProfile?.currentCity || ""}
          placeholder="e.g., Denver, CO"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="occupation"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          What do you do?
        </label>
        <input
          id="occupation"
          name="occupation"
          defaultValue={existingProfile?.occupation || ""}
          placeholder="e.g., Software engineer at Acme Corp"
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="family"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Family
        </label>
        <textarea
          id="family"
          name="family"
          rows={2}
          defaultValue={existingProfile?.family || ""}
          placeholder="e.g., Married with 2 kids, a dog named Barkley..."
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="favoritePHMemory"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Favorite Park Hill Memory
        </label>
        <textarea
          id="favoritePHMemory"
          name="favoritePHMemory"
          rows={3}
          defaultValue={existingProfile?.favoritePHMemory || ""}
          placeholder="That time in Mr. Johnson's class when..."
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="beenUpTo"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          What have you been up to since &apos;96?
        </label>
        <textarea
          id="beenUpTo"
          name="beenUpTo"
          rows={4}
          defaultValue={existingProfile?.beenUpTo || ""}
          placeholder="The highlights of the last 30 years..."
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <div>
        <label
          htmlFor="funFact"
          className="mb-1 block text-sm font-medium text-ink-muted"
        >
          Fun Fact About You
        </label>
        <input
          id="funFact"
          name="funFact"
          defaultValue={existingProfile?.funFact || ""}
          placeholder="e.g., I've visited 47 states, I can juggle flaming torches..."
          className="w-full rounded-lg border border-border-strong px-3 py-2 shadow-sm focus:border-tenant-primary focus:outline-none focus:ring-1 focus:ring-tenant-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-tenant-primary px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-tenant-primary-deep disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
