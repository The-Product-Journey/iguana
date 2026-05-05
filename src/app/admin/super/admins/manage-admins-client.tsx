"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TestTag } from "@/components/test-tag";

type ReunionLite = { id: string; name: string; slug: string };
type AdminRow = {
  id: string;
  reunionId: string;
  email: string;
  clerkUserId: string | null;
  invitedByEmail: string | null;
  createdAt: string;
};
type SuperAdminRow = {
  id: string;
  email: string;
  clerkUserId: string | null;
  invitedByEmail: string | null;
  createdAt: string;
};

type Tab = "reunion" | "super";

export function ManageAdminsClient({
  reunions,
  adminsByReunion,
  superAdmins,
  currentEmail,
}: {
  reunions: ReunionLite[];
  adminsByReunion: Record<string, AdminRow[]>;
  superAdmins: SuperAdminRow[];
  currentEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("reunion");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border-warm">
        <TabButton active={tab === "reunion"} onClick={() => setTab("reunion")}>
          Reunion admins
        </TabButton>
        <TabButton active={tab === "super"} onClick={() => setTab("super")}>
          Super admins ({superAdmins.length})
        </TabButton>
      </div>

      {tab === "reunion" ? (
        <ReunionAdminsTab
          reunions={reunions}
          adminsByReunion={adminsByReunion}
        />
      ) : (
        <SuperAdminsTab
          superAdmins={superAdmins}
          currentEmail={currentEmail}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "border-b-2 px-4 py-2 text-sm font-medium transition " +
        (active
          ? "border-forest text-forest"
          : "border-transparent text-ink-subtle hover:text-ink-muted")
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Reunion admins tab
// ---------------------------------------------------------------------------

function ReunionAdminsTab({
  reunions,
  adminsByReunion,
}: {
  reunions: ReunionLite[];
  adminsByReunion: Record<string, AdminRow[]>;
}) {
  const router = useRouter();
  const [reunionId, setReunionId] = useState(reunions[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reunionId || !email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/super/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId, email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        setEmail("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this admin? They'll lose access immediately.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/super/admins?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={add}
        className="rounded-lg border border-border-warm bg-white p-4 shadow-sm"
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Add reunion admin
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <select
            value={reunionId}
            onChange={(e) => setReunionId(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          >
            {reunions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.slug.endsWith("-test") ? " (test)" : ""}
              </option>
            ))}
          </select>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            disabled={busy}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email || !reunionId}
            className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
          >
            {busy ? "..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </form>

      {reunions.map((r) => {
        const admins = adminsByReunion[r.id] ?? [];
        return (
          <div key={r.id}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
              {r.name}
              {r.slug.endsWith("-test") && <TestTag />}
            </h3>
            {admins.length === 0 ? (
              <p className="text-sm text-ink-subtle">No admins yet.</p>
            ) : (
              <ul className="divide-y divide-border-warm rounded-lg border border-border-warm bg-white shadow-sm">
                {admins.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{a.email}</div>
                      <div className="text-xs text-ink-subtle">
                        {a.clerkUserId ? "linked to Clerk" : "not signed in yet"}
                        {a.invitedByEmail
                          ? ` · invited by ${a.invitedByEmail}`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={busy}
                      className="text-sm text-forest hover:text-forest-deep disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Super admins tab
// ---------------------------------------------------------------------------

function SuperAdminsTab({
  superAdmins,
  currentEmail,
}: {
  superAdmins: SuperAdminRow[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLastSuperAdmin = superAdmins.length <= 1;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/super/super-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        setEmail("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, targetEmail: string) {
    if (
      !confirm(
        `Remove ${targetEmail} as a super admin? They'll lose super-admin access immediately.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/super/super-admins?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Super admins can do anything in any reunion, including managing other
        super admins. New super admins can only be added by an existing super
        admin.
      </p>

      <form
        onSubmit={add}
        className="rounded-lg border border-border-warm bg-white p-4 shadow-sm"
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          Invite super admin
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            disabled={busy}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email}
            className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest-deep disabled:opacity-50"
          >
            {busy ? "..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </form>

      <ul className="divide-y divide-border-warm rounded-lg border border-border-warm bg-white shadow-sm">
        {superAdmins.map((a) => {
          const isSelf = a.email === currentEmail;
          const cannotRemove = isSelf || isLastSuperAdmin;
          const removeReason = isSelf
            ? "You can't remove yourself"
            : isLastSuperAdmin
              ? "Cannot remove the last super admin"
              : "";
          return (
            <li
              key={a.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">
                  {a.email}
                  {isSelf && (
                    <span className="ml-2 rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      you
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-subtle">
                  {a.clerkUserId ? "linked to Clerk" : "not signed in yet"}
                  {a.invitedByEmail
                    ? ` · invited by ${a.invitedByEmail}`
                    : " · system bootstrap"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(a.id, a.email)}
                disabled={busy || cannotRemove}
                title={removeReason}
                className="text-sm text-forest hover:text-forest-deep disabled:cursor-not-allowed disabled:text-ink-subtle"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
