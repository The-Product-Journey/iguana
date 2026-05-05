"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TestTag } from "@/components/test-tag";
import type { InviteStatus } from "@/lib/clerk-invites";

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
  inviteStatus,
}: {
  reunions: ReunionLite[];
  adminsByReunion: Record<string, AdminRow[]>;
  superAdmins: SuperAdminRow[];
  currentEmail: string;
  inviteStatus: Record<string, InviteStatus>;
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
          inviteStatus={inviteStatus}
        />
      ) : (
        <SuperAdminsTab
          superAdmins={superAdmins}
          currentEmail={currentEmail}
          inviteStatus={inviteStatus}
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
// Status pill (shared)
// ---------------------------------------------------------------------------

function InviteStatusPill({ status }: { status: InviteStatus | undefined }) {
  if (!status || status.kind === "none") {
    return (
      <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        No invite sent
      </span>
    );
  }
  if (status.kind === "active") {
    return (
      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
        Active
      </span>
    );
  }
  if (status.kind === "pending") {
    return (
      <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-forest">
        Invite sent
      </span>
    );
  }
  if (status.kind === "expired") {
    return (
      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
        Invite expired
      </span>
    );
  }
  // revoked
  return (
    <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
      Invite revoked
    </span>
  );
}

function inviteDateLabel(status: InviteStatus | undefined): string {
  if (!status) return "";
  if (status.kind === "pending" || status.kind === "expired" || status.kind === "revoked") {
    return ` · sent ${new Date(status.createdAt).toLocaleDateString()}`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Reunion admins tab
// ---------------------------------------------------------------------------

function ReunionAdminsTab({
  reunions,
  adminsByReunion,
  inviteStatus,
}: {
  reunions: ReunionLite[];
  adminsByReunion: Record<string, AdminRow[]>;
  inviteStatus: Record<string, InviteStatus>;
}) {
  const router = useRouter();
  const [reunionId, setReunionId] = useState(reunions[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reunionId || !email) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/super/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId, email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setEmail("");
        if (j.inviteError) {
          setNotice(
            `Added to allowlist, but invite email failed: ${j.inviteError}. Use Resend to retry.`
          );
        } else {
          setNotice("Added and invite sent.");
        }
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
    setNotice(null);
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

  async function resend(id: string, email: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/super/admins/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setNotice(`Invite sent to ${email}.`);
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
            {busy ? "..." : "Add & invite"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {notice && <p className="mt-2 text-sm text-success">{notice}</p>}
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
                {admins.map((a) => {
                  const status = inviteStatus[a.email.toLowerCase()];
                  const canResend =
                    !status ||
                    status.kind === "none" ||
                    status.kind === "pending" ||
                    status.kind === "expired" ||
                    status.kind === "revoked";
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{a.email}</span>
                          <InviteStatusPill status={status} />
                        </div>
                        <div className="text-xs text-ink-subtle">
                          {a.invitedByEmail
                            ? `invited by ${a.invitedByEmail}`
                            : "system bootstrap"}
                          {inviteDateLabel(status)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {canResend && (
                          <button
                            type="button"
                            onClick={() => resend(a.id, a.email)}
                            disabled={busy}
                            className="text-sm text-forest hover:text-forest-deep disabled:opacity-50"
                          >
                            {status?.kind === "pending"
                              ? "Resend"
                              : "Send invite"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(a.id)}
                          disabled={busy}
                          className="text-sm text-danger hover:opacity-80 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
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
  inviteStatus,
}: {
  superAdmins: SuperAdminRow[];
  currentEmail: string;
  inviteStatus: Record<string, InviteStatus>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isLastSuperAdmin = superAdmins.length <= 1;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/super/super-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setEmail("");
        if (j.inviteError) {
          setNotice(
            `Added to allowlist, but invite email failed: ${j.inviteError}. Use Resend to retry.`
          );
        } else {
          setNotice("Added and invite sent.");
        }
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
    setNotice(null);
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

  async function resend(id: string, targetEmail: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/super/super-admins/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Failed (${res.status})`);
      } else {
        setNotice(`Invite sent to ${targetEmail}.`);
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
            {busy ? "..." : "Add & invite"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {notice && <p className="mt-2 text-sm text-success">{notice}</p>}
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
          const status = inviteStatus[a.email.toLowerCase()];
          const canResend =
            !isSelf &&
            (!status ||
              status.kind === "none" ||
              status.kind === "pending" ||
              status.kind === "expired" ||
              status.kind === "revoked");
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.email}</span>
                  {isSelf && (
                    <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      you
                    </span>
                  )}
                  <InviteStatusPill status={status} />
                </div>
                <div className="text-xs text-ink-subtle">
                  {a.invitedByEmail
                    ? `invited by ${a.invitedByEmail}`
                    : "system bootstrap"}
                  {inviteDateLabel(status)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {canResend && (
                  <button
                    type="button"
                    onClick={() => resend(a.id, a.email)}
                    disabled={busy}
                    className="text-sm text-forest hover:text-forest-deep disabled:opacity-50"
                  >
                    {status?.kind === "pending" ? "Resend" : "Send invite"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(a.id, a.email)}
                  disabled={busy || cannotRemove}
                  title={removeReason}
                  className="text-sm text-danger hover:opacity-80 disabled:cursor-not-allowed disabled:text-ink-subtle"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
