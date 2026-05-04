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
      className="flex min-h-[280px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
    >
      <span className="text-sm font-medium">+ Create site</span>
    </button>
  );
}
