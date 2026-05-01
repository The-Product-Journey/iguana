"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReunionLite = { id: string; name: string; slug: string };
type AdminRow = {
  id: string;
  reunionId: string;
  email: string;
  clerkUserId: string | null;
  invitedByEmail: string | null;
  createdAt: string;
};

export function ManageAdminsClient({
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
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Add reunion admin
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <select
            value={reunionId}
            onChange={(e) => setReunionId(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {reunions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email || !reunionId}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {busy ? "..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      {reunions.map((r) => {
        const admins = adminsByReunion[r.id] ?? [];
        return (
          <div key={r.id}>
            <h3 className="mb-2 text-base font-semibold">{r.name}</h3>
            {admins.length === 0 ? (
              <p className="text-sm text-gray-500">No admins yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
                {admins.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{a.email}</div>
                      <div className="text-xs text-gray-500">
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
                      className="text-sm text-red-700 hover:text-red-800 disabled:opacity-50"
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
