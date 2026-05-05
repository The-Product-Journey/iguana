import { AdminMenu } from "./admin-menu";

type SiteMode = "tease" | "pre_register" | "open";

const MODE_LABELS: Record<SiteMode, string> = {
  tease: "Tease",
  pre_register: "Pre-register",
  open: "Open",
};

/**
 * Warning-toned preview banner — visible only when the admin is actively
 * previewing a mode that differs from what the public sees. The AdminMenu
 * sits on the right edge so the admin can change preview / sign out
 * without leaving the banner.
 *
 * When the admin is viewing the same mode as the public (no override, or
 * override matches actual), this component does NOT render — the parent
 * layout puts the AdminMenu somewhere else instead.
 */
export function AdminPreviewBanner({
  slug,
  previewMode,
  actualMode,
}: {
  slug: string;
  previewMode: SiteMode;
  actualMode: SiteMode;
}) {
  return (
    <div className="border-b border-warning/30 bg-warning/10 text-ink">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-warning/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-warning">
            Admin
          </span>
          <span>
            Previewing as <strong>{MODE_LABELS[previewMode]}</strong> — public
            sees <strong>{MODE_LABELS[actualMode]}</strong>
          </span>
        </div>
        <AdminMenu
          slug={slug}
          actualMode={actualMode}
          previewMode={previewMode}
          variant="light"
        />
      </div>
    </div>
  );
}
