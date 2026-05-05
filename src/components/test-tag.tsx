/**
 * Small inline "Test" marker. Used next to a reunion name in admin
 * lists (super-admin sites list, multi-reunion picker, manage-admins
 * page) so admins can tell test tenants from production at a glance.
 *
 * Uses the brand warning token so it stays consistent with the rest of
 * the warning surfaces (AdminPreviewBanner, Connect status warnings,
 * etc.) — and stays in sync if the warning color is ever retuned.
 *
 * `size="sm"` for tight inline use next to small text; `size="md"` for
 * standalone use next to a heading.
 */
type Size = "sm" | "md";

export function TestTag({ size = "sm" }: { size?: Size } = {}) {
  const sizing =
    size === "md"
      ? "px-2 py-0.5 text-xs"
      : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={`rounded bg-warning/10 font-semibold uppercase tracking-wider text-warning ${sizing}`}
    >
      Test
    </span>
  );
}
