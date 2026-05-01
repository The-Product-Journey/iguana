import { AdminMenu } from "./admin-menu";

type SiteMode = "tease" | "pre_register" | "open";

const MODE_LABELS: Record<SiteMode, string> = {
  tease: "Tease",
  pre_register: "Pre-register",
  open: "Open",
};

/**
 * Amber preview banner — visible only when the admin is actively previewing
 * a mode that differs from what the public sees. The AdminMenu sits on the
 * right edge so the admin can change preview / sign out without leaving the
 * banner.
 *
 * When the admin is viewing the same mode as the public (no override, or
 * override matches actual), this component does NOT render — the parent
 * layout puts the AdminMenu somewhere else instead.
 */
export function AdminPreviewBanner({
  previewMode,
  actualMode,
}: {
  previewMode: SiteMode;
  actualMode: SiteMode;
}) {
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Admin
          </span>
          <span>
            Previewing as <strong>{MODE_LABELS[previewMode]}</strong> — public
            sees <strong>{MODE_LABELS[actualMode]}</strong>
          </span>
        </div>
        <AdminMenu
          actualMode={actualMode}
          previewMode={previewMode}
          variant="light"
        />
      </div>
    </div>
  );
}
