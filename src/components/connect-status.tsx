"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ConnectState =
  | "loading"
  | "not_connected"
  | "onboarding_incomplete"
  | "verification_pending"
  | "bank_verification_pending"
  | "active";

export function ConnectStatus({
  reunionId,
  slug,
  connectedAccountId,
  initialHasAccount,
  initialOnboardingComplete,
  initialChargesEnabled,
  initialPayoutsEnabled,
  requireDisconnectPassword = false,
}: {
  reunionId: string;
  slug: string;
  connectedAccountId: string | null;
  initialHasAccount: boolean;
  initialOnboardingComplete: boolean;
  initialChargesEnabled: boolean;
  initialPayoutsEnabled: boolean;
  /**
   * True when STRIPE_DISCONNECT_PASSWORD is set on the deploy. Shows a
   * password field in the disconnect dialog; the server validates it.
   * False (default) → no password field, no server-side password
   * check.
   */
  requireDisconnectPassword?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ConnectState>(() => {
    const initialState = !initialHasAccount
      ? "not_connected"
      : !initialOnboardingComplete
        ? "onboarding_incomplete"
        : !initialChargesEnabled
          ? "verification_pending"
          : !initialPayoutsEnabled
            ? "bank_verification_pending"
            : "active";
    if (typeof window !== "undefined") {
      console.log("[ConnectStatus] mount", {
        reunionId,
        slug,
        connectedAccountId,
        initialProps: {
          initialHasAccount,
          initialOnboardingComplete,
          initialChargesEnabled,
          initialPayoutsEnabled,
        },
        derivedInitialState: initialState,
      });
    }
    return initialState;
  });
  const [loading, setLoading] = useState(false);
  const [busyDashboard, setBusyDashboard] = useState(false);
  const [busyDisconnect, setBusyDisconnect] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnectPassword, setDisconnectPassword] = useState("");
  const [disconnectError, setDisconnectError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const connectParam = searchParams.get("connect");
    console.log("[ConnectStatus] useEffect — URL connect param:", connectParam);

    if (connectParam === "complete") {
      refreshStatus();
    } else if (connectParam === "refresh") {
      handleResumeOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshStatus() {
    console.log("[ConnectStatus] refreshStatus — calling /api/admin/connect/status");
    try {
      const res = await fetch(
        `/api/admin/connect/status?reunionId=${reunionId}`
      );
      const data = await res.json();
      console.log("[ConnectStatus] refreshStatus — response", {
        ok: res.ok,
        httpStatus: res.status,
        data,
      });

      if (!res.ok) {
        setError(data.error || "Failed to check status");
        return;
      }

      if (data.status === null) {
        setState("not_connected");
        console.log("[ConnectStatus] state -> not_connected");
      } else {
        const { detailsSubmitted, chargesEnabled, payoutsEnabled } =
          data.status;
        let next: ConnectState;
        if (!detailsSubmitted) next = "onboarding_incomplete";
        else if (!chargesEnabled) next = "verification_pending";
        else if (!payoutsEnabled) next = "bank_verification_pending";
        else next = "active";
        setState(next);
        console.log("[ConnectStatus] state ->", next, {
          detailsSubmitted,
          chargesEnabled,
          payoutsEnabled,
        });
      }
    } catch (e) {
      console.error("[ConnectStatus] refreshStatus — fetch threw", e);
      setError("Failed to check status");
    }
  }

  async function handleManualRefresh() {
    setLoading(true);
    setError("");
    await refreshStatus();
    setLoading(false);
  }

  function currentReturnPath(): string {
    // Capture the path + query the user is on right now so Stripe brings
    // them back to the same spot (with `?connect=complete` merged in).
    if (typeof window === "undefined") return `/admin/${slug}`;
    return window.location.pathname + window.location.search;
  }

  async function handleSetupPayouts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/connect/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          slug,
          returnPath: currentReturnPath(),
        }),
      });
      // Stale UI: server already has an account. Refresh status from server truth
      // and let the user resume onboarding instead of dead-ending on the error.
      if (res.status === 409) {
        await refreshStatus();
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  async function handleOpenStripeDashboard() {
    if (busyDashboard) return;
    setBusyDashboard(true);
    setError("");
    try {
      const res = await fetch("/api/admin/connect/login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reunionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to open Stripe dashboard");
        setBusyDashboard(false);
        return;
      }
      window.open(data.url, "_blank", "noopener");
      setBusyDashboard(false);
    } catch (e) {
      console.error("[ConnectStatus] handleOpenStripeDashboard threw", e);
      setError("Something went wrong");
      setBusyDashboard(false);
    }
  }

  async function handleResumeOnboarding() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/connect/onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          slug,
          returnPath: currentReturnPath(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate link");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  function openDisconnectDialog() {
    setDisconnectPassword("");
    setDisconnectError("");
    setConfirmDisconnect(true);
  }

  function closeDisconnectDialog() {
    setConfirmDisconnect(false);
    setDisconnectPassword("");
    setDisconnectError("");
  }

  async function handleDisconnect() {
    setBusyDisconnect(true);
    setDisconnectError("");
    try {
      const res = await fetch("/api/admin/connect/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reunionId,
          ...(requireDisconnectPassword ? { password: disconnectPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Stay in the dialog so the user can read the error and
        // (for password failures on live) try again.
        setDisconnectError(data.error || "Failed to disconnect");
        setBusyDisconnect(false);
        return;
      }
      setState("not_connected");
      setBusyDisconnect(false);
      closeDisconnectDialog();
      router.refresh();
    } catch (e) {
      console.error("[ConnectStatus] disconnect threw", e);
      setDisconnectError("Something went wrong");
      setBusyDisconnect(false);
    }
  }

  // Outer card chrome (title, border, padding) is provided by the
  // CollapsibleCard wrapper in the parent admin page. This component
  // renders just the body content for whichever state we're in.
  return (
    <div>
      {state !== "not_connected" && state !== "loading" && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="rounded border border-border-strong px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
            title="Pull live status from Stripe and update the database"
          >
            {loading ? "Refreshing…" : "Refresh status"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-cream p-2 text-sm text-forest">
          {error}
        </div>
      )}

      {state === "loading" && (
        <p className="text-sm text-ink-subtle">Checking status...</p>
      )}

      {state === "not_connected" && (
        <div>
          <p className="mb-3 text-sm text-ink-muted">
            Set up a Stripe account to receive payments directly. The organizer
            will complete a short onboarding form with Stripe.
          </p>
          <button
            onClick={handleSetupPayouts}
            disabled={loading}
            className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-forest-deep disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Set up payouts"}
          </button>
        </div>
      )}

      {state === "onboarding_incomplete" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" />
            <span className="text-sm font-medium text-warning">
              Onboarding incomplete
            </span>
          </div>
          <p className="mb-3 text-sm text-ink-muted">
            The organizer started but didn&apos;t finish Stripe setup. They need
            to complete the onboarding form.
          </p>
          <button
            onClick={handleResumeOnboarding}
            disabled={loading}
            className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-cream disabled:opacity-50"
          >
            {loading ? "Redirecting..." : "Resume onboarding"}
          </button>
        </div>
      )}

      {state === "verification_pending" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" />
            <span className="text-sm font-medium text-warning">
              Verification pending
            </span>
            <span className="text-sm text-ink-subtle">
              — Stripe is reviewing the account. Online payments will be available
              once verified.
            </span>
          </div>
          <div className="mt-3 flex gap-3">
            {connectedAccountId && (
              <button
                onClick={handleOpenStripeDashboard}
                disabled={busyDashboard}
                className="text-sm text-forest hover:text-forest-deep underline disabled:opacity-50"
              >
                {busyDashboard ? "Opening..." : "Open Stripe Dashboard →"}
              </button>
            )}
            <button
              onClick={handleResumeOnboarding}
              disabled={loading}
              className="text-sm text-forest hover:text-forest-deep underline disabled:opacity-50"
            >
              {loading ? "Redirecting..." : "Resume onboarding"}
            </button>
          </div>
        </div>
      )}

      {state === "bank_verification_pending" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" />
            <span className="text-sm font-medium text-warning">
              Bank verification pending
            </span>
            <span className="text-sm text-ink-subtle">
              — Online payments are active. Payouts to bank will begin once
              verification completes.
            </span>
          </div>
          {connectedAccountId && (
            <button
              onClick={handleOpenStripeDashboard}
              disabled={busyDashboard}
              className="mt-3 inline-block text-sm text-forest hover:text-forest-deep underline disabled:opacity-50"
            >
              {busyDashboard ? "Opening..." : "Open Stripe Dashboard →"}
            </button>
          )}
        </div>
      )}

      {state === "active" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-medium text-success">
              Payouts active
            </span>
            <span className="text-sm text-ink-subtle">
              — Payments are being received and paid out to the organizer&apos;s
              bank account.
            </span>
          </div>
          {connectedAccountId && (
            <button
              onClick={handleOpenStripeDashboard}
              disabled={busyDashboard}
              className="mt-3 inline-block text-sm text-forest hover:text-forest-deep underline disabled:opacity-50"
            >
              {busyDashboard ? "Opening..." : "Open Stripe Dashboard →"}
            </button>
          )}
        </div>
      )}

      {/* Danger zone: only visible when there IS a connected account.
          Calls Stripe's Delete API (the dashboard's Remove button is
          blocked for platforms that own loss liability — see Stripe's
          "Consider using the Delete API" hint). Stripe rejects if the
          account has live activity; that error is surfaced. */}
      {state !== "not_connected" && state !== "loading" && (
        <div className="mt-6 border-t border-border-warm pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-ink-subtle">
              Disconnect this account from the reunion. Stripe will delete
              the connected account; the organizer will need to start
              fresh if they want to receive payments again.
            </div>
            <button
              onClick={openDisconnectDialog}
              disabled={busyDisconnect}
              className="rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
            >
              Disconnect Stripe
            </button>
          </div>
        </div>
      )}

      {confirmDisconnect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeDisconnectDialog}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-semibold text-ink">
              Disconnect Stripe?
            </h2>
            <p className="mb-4 text-sm text-ink-muted">
              This deletes the connected Stripe account. Stripe rejects
              deletion if there&apos;s recent activity or a live balance —
              you&apos;d need to handle that first. Reconnecting later means
              starting onboarding from scratch.
            </p>
            {requireDisconnectPassword && (
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
                  value={disconnectPassword}
                  onChange={(e) => setDisconnectPassword(e.target.value)}
                  disabled={busyDisconnect}
                  className="mt-1 w-full rounded-md border border-border-strong px-3 py-1.5 text-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
              </div>
            )}
            {disconnectError && (
              <p className="mb-3 text-sm text-danger">{disconnectError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDisconnectDialog}
                disabled={busyDisconnect}
                className="rounded-md border border-border-strong bg-white px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-bg-subtle disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={
                  busyDisconnect ||
                  (requireDisconnectPassword && disconnectPassword.length === 0)
                }
                className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busyDisconnect ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
