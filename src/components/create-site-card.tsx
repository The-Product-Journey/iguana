"use client";

/**
 * "Create site" placeholder card on the platform homepage. Matches the
 * dashed-border + center-aligned style of Clerk's "Create application"
 * card. The actual site-creation flow isn't built yet — for now clicking
 * just announces that.
 */
export function CreateSiteCard() {
  return (
    <button
      type="button"
      onClick={() => {
        alert("This feature is coming soon.");
      }}
      className="group flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border-strong bg-white text-ink-muted transition-colors hover:border-forest hover:bg-bg-subtle hover:text-forest"
    >
      <span className="text-sm font-medium">+ Create site</span>
    </button>
  );
}
