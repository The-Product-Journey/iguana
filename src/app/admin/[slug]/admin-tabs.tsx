"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import { getSponsorTierLabel } from "@/lib/constants";
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
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-b-2 border-red-600 text-red-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            <span className="ml-1 text-xs text-gray-400">
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Guests</th>
            <th className="px-4 py-3 font-medium text-gray-700">Method</th>
            <th className="px-4 py-3 font-medium text-gray-700">Paid</th>
            <th className="px-4 py-3 font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 font-medium text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rsvps.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No RSVPs yet.
              </td>
            </tr>
          ) : (
            rsvps.map((rsvp) => (
              <tr key={rsvp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {rsvp.firstName} {rsvp.lastName}
                </td>
                <td className="px-4 py-3 text-gray-600">{rsvp.email}</td>
                <td className="px-4 py-3">{rsvp.guestCount}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">
                    {rsvp.paymentMethod || "online"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatCents(rsvp.amountPaidCents || 0)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={rsvp.paymentStatus} />
                </td>
                <td className="px-4 py-3 text-gray-500">
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {interests.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
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
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{i.email}</td>
                  <td className="px-4 py-3 font-medium">
                    {displayName}
                    {i.maidenName && (
                      <span className="ml-1 text-xs text-gray-500">
                        (née {i.maidenName})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
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
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleDisplay(sponsorId: string) {
    setToggling(sponsorId);
    await fetch("/api/admin/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorId, action: "toggleDisplay" }),
    });
    window.location.reload();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Company</th>
            <th className="px-4 py-3 font-medium text-gray-700">Contact</th>
            <th className="px-4 py-3 font-medium text-gray-700">Amount</th>
            <th className="px-4 py-3 font-medium text-gray-700">Tier</th>
            <th className="px-4 py-3 font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 font-medium text-gray-700">Display</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sponsors.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                No sponsors yet.
              </td>
            </tr>
          ) : (
            sponsors.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.companyName || "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.contactName}
                  <br />
                  <span className="text-xs">{s.contactEmail}</span>
                </td>
                <td className="px-4 py-3">{formatCents(s.amountCents)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.tier === "top"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {getSponsorTierLabel(s.tier)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleDisplay(s.id)}
                    disabled={toggling === s.id}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      s.isDisplayed
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {s.isDisplayed ? "Shown" : "Hidden"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Deceased</th>
            <th className="px-4 py-3 font-medium text-gray-700">
              Submitted By
            </th>
            <th className="px-4 py-3 font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 font-medium text-gray-700">
              Review Link
            </th>
            <th className="px-4 py-3 font-medium text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {memorials.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No memorial submissions yet.
              </td>
            </tr>
          ) : (
            memorials.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {m.deceasedFirstName} {m.deceasedLastName}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {m.submitterName}
                  <br />
                  <span className="text-xs">{m.submitterEmail}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "published"
                        ? "bg-green-100 text-green-700"
                        : m.status === "pending_review"
                          ? "bg-blue-100 text-blue-700"
                          : m.status === "draft"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.status}
                  </span>
                  {m.reviewNotes && (
                    <p className="mt-1 text-xs text-amber-600 max-w-xs truncate">
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
                <td className="px-4 py-3 text-gray-500">
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
  const [toggling, setToggling] = useState<string | null>(null);

  async function togglePublished(profileId: string) {
    setToggling(profileId);
    await fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, action: "togglePublished" }),
    });
    window.location.reload();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Completed</th>
            <th className="px-4 py-3 font-medium text-gray-700">Published</th>
            <th className="px-4 py-3 font-medium text-gray-700">
              Edit Link
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {firstName} {lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500">
                      {filled}/6 fields
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublished(profile.id)}
                      disabled={toggling === profile.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        profile.isPublished
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Event</th>
            <th className="px-4 py-3 font-medium text-gray-700">Date</th>
            <th className="px-4 py-3 font-medium text-gray-700">Type</th>
            <th className="px-4 py-3 font-medium text-gray-700">Interested</th>
            <th className="px-4 py-3 font-medium text-gray-700">Registered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{event.name}</td>
              <td className="px-4 py-3 text-gray-600">
                {event.eventDate} {event.eventTime && `· ${event.eventTime}`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    event.type === "paid"
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
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
                <span className="text-green-700">
                  {regCounts[event.id]?.confirmed || 0}
                </span>
                {(regCounts[event.id]?.pending || 0) > 0 && (
                  <span className="ml-1 text-xs text-gray-400">
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Category</th>
            <th className="px-4 py-3 font-medium text-gray-700">Message</th>
            <th className="px-4 py-3 font-medium text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {messages.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No messages yet.
              </td>
            </tr>
          ) : (
            messages.map((msg) => (
              <tr key={msg.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{msg.name}</td>
                <td className="px-4 py-3 text-gray-600">{msg.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {categoryLabels[msg.category] || msg.category}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-gray-600 truncate">
                  {msg.message}
                </td>
                <td className="px-4 py-3 text-gray-500">
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
  const colors =
    status === "paid"
      ? "bg-green-100 text-green-700"
      : status === "pending"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}
