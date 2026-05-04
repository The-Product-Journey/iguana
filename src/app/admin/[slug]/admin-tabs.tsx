"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/utils";
import { getSponsorTierLabel } from "@/lib/constants";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PublishSponsorDialog } from "@/components/publish-sponsor-dialog";
import type {
  Rsvp,
  InterestSignup,
  Sponsor,
  Memorial,
  Profile,
  Event,
} from "@/lib/db/schema";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  createdAt: string;
};

type ProfileWithRsvp = {
  profile: Profile;
  firstName: string;
  lastName: string;
  email: string;
  editToken: string | null;
};

const TABS = [
  "RSVPs",
  "Interests",
  "Sponsors",
  "Memorials",
  "Profiles",
  "Events",
  "Messages",
] as const;

export function AdminTabs({
  slug,
  rsvps,
  interests,
  sponsors,
  memorials,
  profiles,
  events,
  messages,
  interestEventCounts,
  regEventCounts,
  categoryLabels,
}: {
  slug: string;
  rsvps: Rsvp[];
  interests: InterestSignup[];
  sponsors: Sponsor[];
  memorials: Memorial[];
  profiles: ProfileWithRsvp[];
  events: Event[];
  messages: ContactMessage[];
  interestEventCounts: Record<string, number>;
  regEventCounts: Record<string, { confirmed: number; pending: number }>;
  categoryLabels: Record<string, string>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("RSVPs");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border-warm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-b-2 border-forest text-forest"
                : "text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {t}
            <span className="ml-1 text-xs text-ink-subtle">
              {t === "RSVPs" && `(${rsvps.length})`}
              {t === "Interests" && `(${interests.length})`}
              {t === "Sponsors" && `(${sponsors.length})`}
              {t === "Memorials" && `(${memorials.length})`}
              {t === "Profiles" && `(${profiles.length})`}
              {t === "Events" && `(${events.length})`}
              {t === "Messages" && `(${messages.length})`}
            </span>
          </button>
        ))}
      </div>

      {tab === "RSVPs" && <RsvpsTab rsvps={rsvps} />}
      {tab === "Interests" && <InterestsTab interests={interests} />}
      {tab === "Sponsors" && <SponsorsTab sponsors={sponsors} />}
      {tab === "Memorials" && (
        <MemorialsTab memorials={memorials} slug={slug} />
      )}
      {tab === "Profiles" && (
        <ProfilesTab profiles={profiles} slug={slug} />
      )}
      {tab === "Events" && (
        <EventsTab
          events={events}
          interestCounts={interestEventCounts}
          regCounts={regEventCounts}
        />
      )}
      {tab === "Messages" && (
        <MessagesTab messages={messages} categoryLabels={categoryLabels} />
      )}
    </div>
  );
}

function RsvpsTab({ rsvps }: { rsvps: Rsvp[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Name</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Email</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Guests</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Method</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Paid</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {rsvps.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-ink-subtle">
                No RSVPs yet.
              </td>
            </tr>
          ) : (
            rsvps.map((rsvp) => (
              <tr key={rsvp.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 font-medium">
                  {rsvp.firstName} {rsvp.lastName}
                </td>
                <td className="px-4 py-3 text-ink-muted">{rsvp.email}</td>
                <td className="px-4 py-3">{rsvp.guestCount}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-ink-subtle">
                    {rsvp.paymentMethod || "online"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatCents(rsvp.amountPaidCents || 0)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={rsvp.paymentStatus} />
                </td>
                <td className="px-4 py-3 text-ink-subtle">
                  {new Date(rsvp.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function InterestsTab({ interests }: { interests: InterestSignup[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Email</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Name</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {interests.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-ink-subtle">
                No interest signups yet.
              </td>
            </tr>
          ) : (
            interests.map((i) => {
              const displayName =
                i.name ||
                [i.firstName, i.lastName].filter(Boolean).join(" ") ||
                "—";
              return (
                <tr key={i.id} className="hover:bg-bg-subtle">
                  <td className="px-4 py-3 text-ink-muted">{i.email}</td>
                  <td className="px-4 py-3 font-medium">
                    {displayName}
                    {i.maidenName && (
                      <span className="ml-1 text-xs text-ink-subtle">
                        (née {i.maidenName})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-subtle">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SponsorsTab({ sponsors }: { sponsors: Sponsor[] }) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  // Unpublish flow uses the simple yes/no ConfirmDialog
  const [pendingUnpublish, setPendingUnpublish] = useState<string | null>(null);
  // Publish flow uses the richer PublishSponsorDialog (preview + edit)
  const [publishingSponsor, setPublishingSponsor] = useState<Sponsor | null>(null);

  function requestToggle(sponsor: Sponsor) {
    if (sponsor.isDisplayed) {
      setPendingUnpublish(sponsor.id);
    } else {
      setPublishingSponsor(sponsor);
    }
  }

  async function confirmUnpublish() {
    if (!pendingUnpublish) return;
    const sponsorId = pendingUnpublish;
    setPendingUnpublish(null);
    setToggling(sponsorId);
    await fetch("/api/admin/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorId, action: "toggleDisplay" }),
    });
    router.refresh();
    setToggling(null);
  }

  function onPublished() {
    setPublishingSponsor(null);
    router.refresh();
  }

  async function refreshFromStripe(sponsorId: string) {
    setRefreshing(sponsorId);
    try {
      const res = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, action: "refreshFromStripe" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to sync from Stripe");
        setRefreshing(null);
        return;
      }
      router.refresh();
      setRefreshing(null);
    } catch {
      alert("Something went wrong syncing from Stripe");
      setRefreshing(null);
    }
  }

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Company</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Contact</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Amount</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Tier</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Visibility</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {sponsors.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">
                No sponsors yet.
              </td>
            </tr>
          ) : (
            sponsors.map((s) => (
              <tr key={s.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 font-medium">{s.companyName || "—"}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {s.contactName}
                  <br />
                  <span className="text-xs">{s.contactEmail}</span>
                </td>
                <td className="px-4 py-3">{formatCents(s.amountCents)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.tier === "top"
                        ? "bg-cream text-forest"
                        : "bg-bg-subtle text-ink-muted"
                    }`}
                  >
                    {getSponsorTierLabel(s.tier)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.paymentStatus} />
                    {s.stripeCheckoutSessionId && (
                      <button
                        onClick={() => refreshFromStripe(s.id)}
                        disabled={refreshing === s.id}
                        title="Sync payment status from Stripe"
                        className="rounded border border-border-strong px-2 py-0.5 text-xs font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
                      >
                        {refreshing === s.id ? "Syncing…" : "Refresh"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => requestToggle(s)}
                    disabled={toggling === s.id}
                    title={
                      s.isDisplayed
                        ? "Currently published — click to unpublish"
                        : "Currently a draft — click to publish to the public site"
                    }
                    className={`text-sm underline-offset-2 hover:underline disabled:opacity-50 ${
                      s.isDisplayed
                        ? "text-ink-subtle hover:text-ink-muted"
                        : "text-success hover:opacity-80"
                    }`}
                  >
                    {s.isDisplayed ? "Unpublish" : "Publish"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <ConfirmDialog
      open={pendingUnpublish !== null}
      title="Unpublish sponsor?"
      message="They won't be shown on the public sponsors page until you republish."
      confirmLabel="Unpublish"
      confirmVariant="neutral"
      onConfirm={confirmUnpublish}
      onCancel={() => setPendingUnpublish(null)}
    />
    <PublishSponsorDialog
      open={publishingSponsor !== null}
      sponsor={publishingSponsor}
      onCancel={() => setPublishingSponsor(null)}
      onPublished={onPublished}
    />
    </>
  );
}

function MemorialsTab({
  memorials,
  slug,
}: {
  memorials: Memorial[];
  slug: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Deceased</th>
            <th className="px-4 py-3 font-medium text-ink-muted">
              Submitted By
            </th>
            <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
            <th className="px-4 py-3 font-medium text-ink-muted">
              Review Link
            </th>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {memorials.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                No memorial submissions yet.
              </td>
            </tr>
          ) : (
            memorials.map((m) => (
              <tr key={m.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 font-medium">
                  {m.deceasedFirstName} {m.deceasedLastName}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {m.submitterName}
                  <br />
                  <span className="text-xs">{m.submitterEmail}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "published"
                        ? "bg-success/10 text-success"
                        : m.status === "pending_review"
                          ? "bg-forest/10 text-forest"
                          : m.status === "draft"
                            ? "bg-warning/10 text-warning"
                            : "bg-bg-subtle text-ink-muted"
                    }`}
                  >
                    {m.status}
                  </span>
                  {m.reviewNotes && (
                    <p className="mt-1 text-xs text-warning max-w-xs truncate">
                      Notes: {m.reviewNotes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/${slug}/memorial/review/${m.reviewToken}`;
                      navigator.clipboard.writeText(url);
                      alert("Review link copied to clipboard!");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Copy Link
                  </button>
                </td>
                <td className="px-4 py-3 text-ink-subtle">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProfilesTab({
  profiles,
  slug,
}: {
  profiles: ProfileWithRsvp[];
  slug: string;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);

  async function togglePublished(profileId: string) {
    setToggling(profileId);
    await fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, action: "togglePublished" }),
    });
    router.refresh();
    setToggling(null);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Name</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Email</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Completed</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Published</th>
            <th className="px-4 py-3 font-medium text-ink-muted">
              Edit Link
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                No profiles yet.
              </td>
            </tr>
          ) : (
            profiles.map(({ profile, firstName, lastName, email, editToken }) => {
              const fields = [
                profile.currentCity,
                profile.occupation,
                profile.family,
                profile.favoritePHMemory,
                profile.beenUpTo,
                profile.funFact,
              ];
              const filled = fields.filter(Boolean).length;
              return (
                <tr key={profile.id} className="hover:bg-bg-subtle">
                  <td className="px-4 py-3 font-medium">
                    {firstName} {lastName}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-ink-subtle">
                      {filled}/6 fields
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublished(profile.id)}
                      disabled={toggling === profile.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        profile.isPublished
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : "bg-bg-subtle text-ink-subtle hover:bg-border-warm"
                      }`}
                    >
                      {profile.isPublished ? "Published" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {editToken && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/${slug}/profile/${editToken}`;
                          navigator.clipboard.writeText(url);
                          alert("Profile edit link copied!");
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy Link
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventsTab({
  events,
  interestCounts,
  regCounts,
}: {
  events: Event[];
  interestCounts: Record<string, number>;
  regCounts: Record<string, { confirmed: number; pending: number }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Event</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Type</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Interested</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Registered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-bg-subtle">
              <td className="px-4 py-3 font-medium">{event.name}</td>
              <td className="px-4 py-3 text-ink-muted">
                {event.eventDate} {event.eventTime && `· ${event.eventTime}`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    event.type === "paid"
                      ? "bg-forest/10 text-forest"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {event.type === "paid"
                    ? formatCents(event.priceCents || 0)
                    : "Free"}
                </span>
              </td>
              <td className="px-4 py-3">
                {interestCounts[event.id] || 0}
              </td>
              <td className="px-4 py-3">
                <span className="text-success">
                  {regCounts[event.id]?.confirmed || 0}
                </span>
                {(regCounts[event.id]?.pending || 0) > 0 && (
                  <span className="ml-1 text-xs text-ink-subtle">
                    (+{regCounts[event.id]?.pending} pending)
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesTab({
  messages,
  categoryLabels,
}: {
  messages: ContactMessage[];
  categoryLabels: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Name</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Email</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Category</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Message</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {messages.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                No messages yet.
              </td>
            </tr>
          ) : (
            messages.map((msg) => (
              <tr key={msg.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 font-medium">{msg.name}</td>
                <td className="px-4 py-3 text-ink-muted">{msg.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {categoryLabels[msg.category] || msg.category}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-ink-muted truncate">
                  {msg.message}
                </td>
                <td className="px-4 py-3 text-ink-subtle">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // Status colors use brand tokens (--color-success/warning/danger) so
  // they harmonize with the Glad You Made It palette while still reading
  // unambiguously as good/warning/danger. Failed and refunded both fall
  // through to the danger color.
  const colors =
    status === "paid"
      ? "bg-success/10 text-success"
      : status === "pending"
        ? "bg-warning/10 text-warning"
        : "bg-danger/10 text-danger";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}
