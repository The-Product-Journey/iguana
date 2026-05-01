"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
}: {
  reunionId: string;
  slug: string;
  connectedAccountId: string | null;
  initialHasAccount: boolean;
  initialOnboardingComplete: boolean;
  initialChargesEnabled: boolean;
  initialPayoutsEnabled: boolean;
}) {
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

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Stripe Connect — Payouts
        </h3>
        {state !== "not_connected" && state !== "loading" && (
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            title="Pull live status from Stripe and update the database"
          >
            {loading ? "Refreshing…" : "Refresh status"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {state === "loading" && (
        <p className="text-sm text-gray-500">Checking status...</p>
      )}

      {state === "not_connected" && (
        <div>
          <p className="mb-3 text-sm text-gray-600">
            Set up a Stripe account to receive payments directly. The organizer
            will complete a short onboarding form with Stripe.
          </p>
          <button
            onClick={handleSetupPayouts}
            disabled={loading}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-800 disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Set up payouts"}
          </button>
        </div>
      )}

      {state === "onboarding_incomplete" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-700">
              Onboarding incomplete
            </span>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            The organizer started but didn&apos;t finish Stripe setup. They need
            to complete the onboarding form.
          </p>
          <button
            onClick={handleResumeOnboarding}
            disabled={loading}
            className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            {loading ? "Redirecting..." : "Resume onboarding"}
          </button>
        </div>
      )}

      {state === "verification_pending" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-700">
              Verification pending
            </span>
            <span className="text-sm text-gray-500">
              — Stripe is reviewing the account. Online payments will be available
              once verified.
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {connectedAccountId && (
              <a
                href={`https://dashboard.stripe.com/connect/accounts/${connectedAccountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-700 hover:text-red-800 underline"
              >
                View in Stripe →
              </a>
            )}
            <button
              onClick={handleResumeOnboarding}
              disabled={loading}
              className="text-sm text-red-700 hover:text-red-800 underline disabled:opacity-50"
            >
              {loading ? "Redirecting..." : "Resume onboarding"}
            </button>
          </div>
        </div>
      )}

      {state === "bank_verification_pending" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-700">
              Bank verification pending
            </span>
            <span className="text-sm text-gray-500">
              — Online payments are active. Payouts to bank will begin once
              verification completes.
            </span>
          </div>
          {connectedAccountId && (
            <a
              href={`https://dashboard.stripe.com/connect/accounts/${connectedAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-red-700 hover:text-red-800 underline"
            >
              View in Stripe →
            </a>
          )}
        </div>
      )}

      {state === "active" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700">
              Payouts active
            </span>
            <span className="text-sm text-gray-500">
              — Payments are being received and paid out to the organizer&apos;s
              bank account.
            </span>
          </div>
          {connectedAccountId && (
            <a
              href={`https://dashboard.stripe.com/connect/accounts/${connectedAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-red-700 hover:text-red-800 underline"
            >
              View in Stripe →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
