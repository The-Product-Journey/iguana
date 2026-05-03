"use client";

import { useEffect } from "react";

type ConfirmVariant = "green" | "red" | "neutral";

const VARIANT_STYLES: Record<ConfirmVariant, string> = {
  green: "bg-green-700 hover:bg-green-800 focus:ring-green-500",
  red: "bg-red-700 hover:bg-red-800 focus:ring-red-500",
  neutral: "bg-gray-700 hover:bg-gray-800 focus:ring-gray-500",
};

/**
 * Generic confirmation modal — replaces window.confirm() for actions that
 * deserve a deliberate "are you sure" check (publishing/unpublishing,
 * destructive operations, etc).
 *
 * Click outside or hit Escape to cancel. Confirm button color comes from
 * the `confirmVariant` prop so callers can signal positive (green),
 * destructive (red), or neutral actions.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "red",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "confirm-dialog-title" : undefined}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2
            id="confirm-dialog-title"
            className="mb-2 text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
        )}
        <p className="mb-6 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${VARIANT_STYLES[confirmVariant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
