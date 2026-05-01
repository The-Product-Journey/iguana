"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReunionSettings = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  eventDate: string;
  registrationFeeCents: number;
  isActive: boolean;
  orgName: string | null;
  orgShortName: string | null;
  mascot: string | null;
  classYear: string | null;
  reunionMilestoneLabel: string | null;
  brandColorPrimary: string | null;
  brandColorPrimaryDark: string | null;
  logoUrl: string | null;
  communityServiceProjectName: string | null;
  communityServiceCharityName: string | null;
  communityServiceTeaserCopy: string | null;
  communityServiceFullCopy: string | null;
  sponsorTopTierLabel: string | null;
  sponsorCommunityTierLabel: string | null;
  favoriteMemoryLabel: string | null;
  banquetLabel: string | null;
};

export function SettingsClient({
  reunion,
  isSuper,
}: {
  reunion: ReunionSettings;
  isSuper: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(reunion.name);
  const [description, setDescription] = useState(reunion.description ?? "");
  const [eventDate, setEventDate] = useState(reunion.eventDate);
  const [registrationFeeDollars, setRegistrationFeeDollars] = useState(
    (reunion.registrationFeeCents / 100).toFixed(2)
  );
  const [orgName, setOrgName] = useState(reunion.orgName ?? "");
  const [orgShortName, setOrgShortName] = useState(reunion.orgShortName ?? "");
  const [mascot, setMascot] = useState(reunion.mascot ?? "");
  const [classYear, setClassYear] = useState(reunion.classYear ?? "");
  const [reunionMilestoneLabel, setReunionMilestoneLabel] = useState(
    reunion.reunionMilestoneLabel ?? ""
  );
  const [brandColorPrimary, setBrandColorPrimary] = useState(
    reunion.brandColorPrimary ?? ""
  );
  const [brandColorPrimaryDark, setBrandColorPrimaryDark] = useState(
    reunion.brandColorPrimaryDark ?? ""
  );
  const [logoUrl, setLogoUrl] = useState(reunion.logoUrl ?? "");
  const [csProjectName, setCsProjectName] = useState(
    reunion.communityServiceProjectName ?? ""
  );
  const [csCharityName, setCsCharityName] = useState(
    reunion.communityServiceCharityName ?? ""
  );
  const [csTeaser, setCsTeaser] = useState(
    reunion.communityServiceTeaserCopy ?? ""
  );
  const [csFull, setCsFull] = useState(
    reunion.communityServiceFullCopy ?? ""
  );
  const [topTierLabel, setTopTierLabel] = useState(
    reunion.sponsorTopTierLabel ?? ""
  );
  const [communityTierLabel, setCommunityTierLabel] = useState(
    reunion.sponsorCommunityTierLabel ?? ""
  );
  const [favoriteMemoryLabel, setFavoriteMemoryLabel] = useState(
    reunion.favoriteMemoryLabel ?? ""
  );
  const [banquetLabel, setBanquetLabel] = useState(reunion.banquetLabel ?? "");

  // Super-only state
  const [isActive, setIsActive] = useState(reunion.isActive);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Re-seed dialog state (super-only)
  const [reseedConfirming, setReseedConfirming] = useState(false);
  const [reseedRunning, setReseedRunning] = useState(false);
  const [reseedResult, setReseedResult] = useState<string | null>(null);
  const [reseedError, setReseedError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const dollars = parseFloat(registrationFeeDollars);
    const registrationFeeCents =
      Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : undefined;

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      eventDate: eventDate.trim(),
      orgName: orgName.trim() || null,
      orgShortName: orgShortName.trim() || null,
      mascot: mascot.trim() || null,
      classYear: classYear.trim() || null,
      reunionMilestoneLabel: reunionMilestoneLabel.trim() || null,
      brandColorPrimary: brandColorPrimary.trim() || null,
      brandColorPrimaryDark: brandColorPrimaryDark.trim() || null,
      logoUrl: logoUrl.trim() || null,
      communityServiceProjectName: csProjectName.trim() || null,
      communityServiceCharityName: csCharityName.trim() || null,
      communityServiceTeaserCopy: csTeaser.trim() || null,
      communityServiceFullCopy: csFull.trim() || null,
      sponsorTopTierLabel: topTierLabel.trim() || null,
      sponsorCommunityTierLabel: communityTierLabel.trim() || null,
      favoriteMemoryLabel: favoriteMemoryLabel.trim() || null,
      banquetLabel: banquetLabel.trim() || null,
    };
    if (registrationFeeCents !== undefined) {
      body.registrationFeeCents = registrationFeeCents;
    }
    if (isSuper) {
      body.isActive = isActive;
    }

    try {
      const res = await fetch(`/api/admin/reunion/${reunion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Save failed.");
        setSaving(false);
        return;
      }
      setSuccess("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function runReseed() {
    setReseedRunning(true);
    setReseedError(null);
    setReseedResult(null);
    try {
      const res = await fetch(
        `/api/admin/reunion/${reunion.id}/reseed`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        setReseedError(
          json.error ||
            "Reseed failed. The tenant may not be empty — check the admin dashboard."
        );
        setReseedRunning(false);
        return;
      }
      setReseedResult(
        `Demo data laid down: ${json.result.events} events, ` +
          `${json.result.rsvps} RSVPs, ${json.result.profiles} profiles, ` +
          `${json.result.sponsors} sponsors, ${json.result.memorials} memorial.`
      );
      setReseedRunning(false);
      setReseedConfirming(false);
      router.refresh();
    } catch (err) {
      setReseedError(err instanceof Error ? err.message : "Network error.");
      setReseedRunning(false);
    }
  }

  function field(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { placeholder?: string; help?: string; required?: boolean; type?: string }
  ) {
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
          {opts?.required ? <span className="text-red-600"> *</span> : null}
        </label>
        <input
          id={id}
          type={opts?.type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={opts?.required}
          placeholder={opts?.placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {opts?.help ? (
          <p className="mt-1 text-xs text-gray-500">{opts.help}</p>
        ) : null}
      </div>
    );
  }

  function textarea(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { rows?: number; placeholder?: string; help?: string }
  ) {
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        <textarea
          id={id}
          rows={opts?.rows ?? 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={opts?.placeholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {opts?.help ? (
          <p className="mt-1 text-xs text-gray-500">{opts.help}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="max-w-2xl space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Basics</h3>
        {field("name", "Reunion name", name, setName, { required: true })}
        {textarea(
          "description",
          "Description",
          description,
          setDescription,
          { rows: 2, help: "Subtitle / hero paragraph on the public landing." }
        )}
        {field("eventDate", "Event date", eventDate, setEventDate, {
          type: "date",
          required: true,
        })}
        {field(
          "registrationFee",
          "Banquet registration fee (USD)",
          registrationFeeDollars,
          setRegistrationFeeDollars,
          { type: "number", help: "Stored as cents internally." }
        )}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Identity &amp; copy
        </h3>
        {field("orgName", "Organization name", orgName, setOrgName, {
          placeholder: "Riverside High School",
          help: "Used in sponsor checkout descriptions and confirmation copy.",
        })}
        {field(
          "orgShortName",
          "Short brand label",
          orgShortName,
          setOrgShortName,
          {
            placeholder: "Riverside '10",
            help: "Header label on the public site nav.",
          }
        )}
        {field("mascot", "Mascot", mascot, setMascot, {
          placeholder: "Tigers",
          help: "Optional flourish. When set, confirmation page reads \"You're All Set, Tigers!\"",
        })}
        {field("classYear", "Class year", classYear, setClassYear, {
          placeholder: "2010",
        })}
        {field(
          "reunionMilestoneLabel",
          "Reunion milestone label",
          reunionMilestoneLabel,
          setReunionMilestoneLabel,
          {
            placeholder: "15 Year Reunion",
            help: "Subtitle under the hero name.",
          }
        )}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
        {field(
          "brandColorPrimary",
          "Primary brand color (hex)",
          brandColorPrimary,
          setBrandColorPrimary,
          {
            placeholder: "#b91c1c",
            help: "Emitted as --brand-primary CSS variable. Defaults to red-700.",
          }
        )}
        {field(
          "brandColorPrimaryDark",
          "Primary brand color, dark (hex)",
          brandColorPrimaryDark,
          setBrandColorPrimaryDark,
          { placeholder: "#7f1d1d" }
        )}
        {field("logoUrl", "Logo URL", logoUrl, setLogoUrl, {
          placeholder: "https://…",
        })}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Community service project
        </h3>
        <p className="text-xs text-gray-500">
          Setting Project Name turns on the homepage block and the dedicated
          /community-service page. Leave Project Name empty to hide both.
        </p>
        {field(
          "csProjectName",
          "Project name",
          csProjectName,
          setCsProjectName,
          { placeholder: "Riverside School Supply Drive" }
        )}
        {field(
          "csCharityName",
          "Partner charity",
          csCharityName,
          setCsCharityName,
          { placeholder: "Local Schools Foundation" }
        )}
        {textarea(
          "csTeaser",
          "Homepage teaser copy",
          csTeaser,
          setCsTeaser,
          { rows: 2, help: "Short blurb shown in the homepage CS block." }
        )}
        {textarea(
          "csFull",
          "Full project copy",
          csFull,
          setCsFull,
          {
            rows: 6,
            help: "Long-form copy for the /community-service page. Blank lines start new paragraphs.",
          }
        )}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">Sponsor &amp; yearbook labels</h3>
        {field(
          "topTierLabel",
          "Top sponsor tier label",
          topTierLabel,
          setTopTierLabel,
          { placeholder: "Top", help: "Public label, e.g. \"Trojan\"." }
        )}
        {field(
          "communityTierLabel",
          "Community sponsor tier label",
          communityTierLabel,
          setCommunityTierLabel,
          { placeholder: "Community" }
        )}
        {field(
          "favoriteMemoryLabel",
          "Yearbook memory field label",
          favoriteMemoryLabel,
          setFavoriteMemoryLabel,
          {
            placeholder: "Favorite School Memory",
            help: "Header for the open-text memory field on profile forms / pages.",
          }
        )}
        {field(
          "banquetLabel",
          "Banquet label on landing page",
          banquetLabel,
          setBanquetLabel,
          { placeholder: "Banquet" }
        )}
      </section>

      {/* Super-admin only: visibility + reseed */}
      {isSuper && (
        <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-lg font-semibold text-amber-900">
            Super-admin controls
          </h3>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-amber-900">Active</p>
              <p className="mt-0.5 text-xs text-amber-800">
                When unchecked, the public reunion URL returns 404 to
                everyone except admins for this reunion (or super admins).
                Soft-delete lever — data is preserved.
              </p>
            </div>
          </label>

          <div className="border-t border-amber-200 pt-4">
            <p className="text-sm font-medium text-amber-900">
              Re-seed with demo data
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Lays down the generic demo dataset (4 events, 10 RSVPs, etc.)
              for this reunion. Fails if any tenant-scoped table already
              has rows for this reunion — the operator must wipe first.
            </p>
            {reseedResult && (
              <p className="mt-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
                {reseedResult}
              </p>
            )}
            {reseedError && (
              <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                {reseedError}
              </p>
            )}
            {!reseedConfirming ? (
              <button
                type="button"
                onClick={() => {
                  setReseedConfirming(true);
                  setReseedResult(null);
                  setReseedError(null);
                }}
                className="mt-3 rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Re-seed demo data…
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-white p-3 text-xs">
                <p className="text-amber-900">
                  Lay down demo data on this reunion now? This refuses if the
                  reunion already has any data.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={runReseed}
                    disabled={reseedRunning}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:bg-gray-300"
                  >
                    {reseedRunning ? "Reseeding…" : "Confirm reseed"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReseedConfirming(false)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 disabled:bg-gray-300"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
