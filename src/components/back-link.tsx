"use client";

/**
 * Inline "← Back" button that defers to the browser's history. Useful in
 * places where the right destination depends on where the user actually
 * came from — admin landed here from a public reunion site? Send them
 * back there. Came from the super-admin overview? Send them there. The
 * browser already knows; we just call history.back().
 *
 * Falls back to a plain anchor at `fallbackHref` for users with no JS
 * (e.g. crawlers) or when there's no history entry to go back to.
 */
export function BackLink({ fallbackHref = "/" }: { fallbackHref?: string }) {
  return (
    <a
      href={fallbackHref}
      onClick={(e) => {
        // Use the browser's history when available — does the right thing
        // for "came from anywhere" navigation. The fallbackHref keeps the
        // anchor semantically valid for non-JS clients and degraded paths.
        if (typeof window !== "undefined" && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      }}
      className="mb-4 inline-block text-sm text-forest hover:text-forest-deep"
    >
      &larr; Back
    </a>
  );
}
