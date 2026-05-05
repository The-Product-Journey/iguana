"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCents } from "@/lib/utils";
import { TestTag } from "@/components/test-tag";

type AccountRow = {
  id: string;
  accountId: string;
  environment: "test" | "live";
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  createdAt: string;
  reunionId: string;
  reunionSlug: string;
  reunionName: string;
  name: string | null;
};

type RsvpRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  amountPaidCents: number | null;
  paymentStatus: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  reunionId: string;
  reunionName: string;
  reunionSlug: string;
};

type SponsorRow = {
  id: string;
  contactName: string;
  contactEmail: string;
  companyName: string | null;
  amountCents: number;
  paymentStatus: string;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  reunionId: string;
  reunionName: string;
  reunionSlug: string;
};

type Tab = "rsvp" | "sponsor";
type RangeKey = "30d" | "90d" | "1y" | "all";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
  { value: "all", label: "All time" },
];

// Stripe dashboard URL for a checkout session — the cs_test_/cs_live_
// prefix decides which environment we link to so each row's link
// always lands in the right dashboard regardless of current deploy.
function stripeSessionUrl(sessionId: string): string {
  const isTest = sessionId.startsWith("cs_test_");
  return `https://dashboard.stripe.com/${isTest ? "test/" : ""}checkout/sessions/${sessionId}`;
}

function stripeAccountUrl(accountId: string, env: "test" | "live"): string {
  return `https://dashboard.stripe.com/${env === "test" ? "test/" : ""}connect/accounts/${accountId}`;
}

export function PaymentsClient({
  accounts,
  rsvpPayments,
  sponsorPayments,
  range,
  currentEnv,
  passwordRequired,
}: {
  accounts: AccountRow[];
  rsvpPayments: RsvpRow[];
  sponsorPayments: SponsorRow[];
  range: RangeKey;
  currentEnv: "test" | "live";
  passwordRequired: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("rsvp");

  function setRange(next: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-12">
      <ConnectedAccountsSection
        accounts={accounts}
        currentEnv={currentEnv}
        passwordRequired={passwordRequired}
      />

      <section>
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">Payments</h3>
            <p className="text-xs text-ink-muted">
              Showing rows from {RANGE_OPTIONS.find((r) => r.value === range)?.label.toLowerCase()}.
            </p>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  range === opt.value
                    ? "bg-forest text-on-forest"
                    : "border border-border-strong text-ink-muted hover:bg-bg-subtle"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mb-3 flex gap-1 border-b border-border-warm">
          <TabButton active={tab === "rsvp"} onClick={() => setTab("rsvp")}>
            RSVP payments ({rsvpPayments.length})
          </TabButton>
          <TabButton
            active={tab === "sponsor"}
            onClick={() => setTab("sponsor")}
          >
            Sponsor payments ({sponsorPayments.length})
          </TabButton>
        </div>

        {tab === "rsvp" ? (
          <RsvpPaymentsTable rows={rsvpPayments} />
        ) : (
          <SponsorPaymentsTable rows={sponsorPayments} />
        )}
      </section>
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
// Connected accounts
// ---------------------------------------------------------------------------

type DisconnectMode = "stripe" | "force";

type PendingAction =
  | { kind: "stripe"; row: AccountRow }
  | { kind: "force"; row: AccountRow }
  | null;

function ConnectedAccountsSection({
  accounts,
  currentEnv,
  passwordRequired,
}: {
  accounts: AccountRow[];
  currentEnv: "test" | "live";
  passwordRequired: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  function open(mode: DisconnectMode, row: AccountRow) {
    setPending({ kind: mode, row });
    setPassword("");
    setError(null);
  }

  function close() {
    setPending(null);
    setPassword("");
    setError(null);
    setBusy(false);
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const url =
        pending.kind === "stripe"
          ? "/api/admin/connect/disconnect"
          : "/api/admin/connect/force-delete";
      const body =
        pending.kind === "stripe"
          ? { reunionId: pending.row.reunionId, ...(passwordRequired ? { password } : {}) }
          : { id: pending.row.id, ...(passwordRequired ? { password } : {}) };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <section>
      <header className="mb-3">
        <h3 className="text-base font-semibold text-ink">
          Connected accounts ({accounts.length})
        </h3>
        <p className="text-xs text-ink-muted">
          Every Stripe Connect account across reunions and environments.
          Cross-environment rows (e.g. live rows when the deploy is on test
          keys) can&apos;t be inspected via the live name field below — you
          can still force delete the local mapping.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-warm bg-bg-subtle">
            <tr>
              <th className="px-4 py-3 font-medium text-ink-muted">Reunion</th>
              <th className="px-4 py-3 font-medium text-ink-muted">Env</th>
              <th className="px-4 py-3 font-medium text-ink-muted">Account</th>
              <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
              <th className="px-4 py-3 font-medium text-ink-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-warm">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                  No connected accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((a) => {
                const sameEnv = a.environment === currentEnv;
                return (
                  <tr key={a.id} className="hover:bg-bg-subtle align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/${a.reunionSlug}`}
                        className="font-medium text-ink hover:text-forest"
                      >
                        {a.reunionName}
                      </Link>
                      {a.reunionSlug.endsWith("-test") && (
                        <span className="ml-2">
                          <TestTag />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          a.environment === "live"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {a.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="break-all font-mono text-xs text-ink">
                        {a.accountId}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        {sameEnv
                          ? a.name ?? (
                              <span className="text-ink-subtle italic">
                                Name unavailable
                              </span>
                            )
                          : (
                              <span className="text-ink-subtle italic">
                                Different env — not inspectable from this deploy
                              </span>
                            )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className={a.chargesEnabled ? "text-success" : "text-ink-subtle"}>
                          {a.chargesEnabled ? "✓" : "—"} charges
                        </span>
                        <span className={a.payoutsEnabled ? "text-success" : "text-ink-subtle"}>
                          {a.payoutsEnabled ? "✓" : "—"} payouts
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={stripeAccountUrl(a.accountId, a.environment)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-forest underline decoration-forest/40 underline-offset-2 hover:text-forest-deep hover:decoration-forest"
                        >
                          View in Stripe →
                        </a>
                        {sameEnv && (
                          <button
                            type="button"
                            onClick={() => open("stripe", a)}
                            disabled={busy}
                            className="rounded border border-border-strong px-2 py-0.5 text-xs font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
                          >
                            Disconnect
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => open("force", a)}
                          disabled={busy}
                          className="rounded border border-danger px-2 py-0.5 text-xs font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                        >
                          Force delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-ink">
              {pending.kind === "stripe"
                ? "Disconnect Stripe?"
                : "Force delete (DB only)?"}
            </h2>
            <p className="mb-4 text-sm text-ink-muted">
              {pending.kind === "stripe" ? (
                <>
                  Calls Stripe&apos;s Delete API on{" "}
                  <span className="font-mono text-xs">{pending.row.accountId}</span>{" "}
                  and clears the local mapping. Stripe rejects deletion if there&apos;s
                  recent activity or a live balance — that error is surfaced here.
                </>
              ) : (
                <>
                  Removes the local row only. Stripe is{" "}
                  <strong>not</strong> notified — the connected account on
                  Stripe&apos;s side stays intact. Use this when Stripe&apos;s
                  delete is stuck and you need to decouple our DB from a
                  ghosted account. The Stripe-side cleanup is your problem.
                </>
              )}
            </p>
            <div className="mb-4 rounded-md border border-border-warm bg-bg-subtle p-3 text-xs">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Reunion
              </div>
              <div className="text-ink">{pending.row.reunionName}</div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Account ID
              </div>
              <div className="break-all font-mono text-ink">
                {pending.row.accountId}
              </div>
            </div>
            {passwordRequired && (
              <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3">
                <p className="mb-2 text-sm font-medium text-danger">
                  Extra confirmation required.
                </p>
                <label className="block text-xs font-medium text-ink-muted">
                  Disconnect password
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-md border border-border-strong px-3 py-1.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
            )}
            {error && <p className="mb-3 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-md border border-border-strong bg-white px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={
                  busy || (passwordRequired && password.length === 0)
                }
                className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? pending.kind === "stripe"
                    ? "Disconnecting…"
                    : "Force deleting…"
                  : pending.kind === "stripe"
                    ? "Disconnect"
                    : "Force delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Payments tables
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string | null }) {
  const s = status ?? "—";
  const cls =
    s === "paid"
      ? "bg-success/10 text-success"
      : s === "failed"
        ? "bg-danger/10 text-danger"
        : s === "pending"
          ? "bg-warning/10 text-warning"
          : "bg-bg-subtle text-ink-muted";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {s}
    </span>
  );
}

function RsvpPaymentsTable({ rows }: { rows: RsvpRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Reunion</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Customer</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Amount</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Stripe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">
                No RSVP payments in the selected range.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 text-ink-subtle">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/${r.reunionSlug}`}
                    className="text-ink hover:text-forest"
                  >
                    {r.reunionName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="text-xs text-ink-subtle">{r.email}</div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatCents(r.amountPaidCents ?? 0)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={r.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  {r.stripeCheckoutSessionId ? (
                    <a
                      href={stripeSessionUrl(r.stripeCheckoutSessionId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-forest underline decoration-forest/40 underline-offset-2 hover:text-forest-deep hover:decoration-forest"
                    >
                      View →
                    </a>
                  ) : (
                    <span className="text-xs text-ink-subtle">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SponsorPaymentsTable({ rows }: { rows: SponsorRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-warm bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-warm bg-bg-subtle">
          <tr>
            <th className="px-4 py-3 font-medium text-ink-muted">Date</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Reunion</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Sponsor</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Amount</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Status</th>
            <th className="px-4 py-3 font-medium text-ink-muted">Stripe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">
                No sponsor payments in the selected range.
              </td>
            </tr>
          ) : (
            rows.map((s) => (
              <tr key={s.id} className="hover:bg-bg-subtle">
                <td className="px-4 py-3 text-ink-subtle">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/${s.reunionSlug}`}
                    className="text-ink hover:text-forest"
                  >
                    {s.reunionName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {s.companyName || s.contactName}
                  </div>
                  <div className="text-xs text-ink-subtle">{s.contactEmail}</div>
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatCents(s.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={s.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  {s.stripeCheckoutSessionId ? (
                    <a
                      href={stripeSessionUrl(s.stripeCheckoutSessionId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-forest underline decoration-forest/40 underline-offset-2 hover:text-forest-deep hover:decoration-forest"
                    >
                      View →
                    </a>
                  ) : (
                    <span className="text-xs text-ink-subtle">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
