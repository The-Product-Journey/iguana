/**
 * Outline pill that takes a signed-in admin from the canonical-domain
 * version of the public reunion site to the tenant's vanity domain —
 * "see what attendees see at the real URL." Renders only when a vanity
 * domain is configured (without one, the launch icon already opens the
 * equivalent platform path; this would be redundant).
 *
 * Sits to the left of the AdminMenu in SiteNav and TeaseLanding. The
 * `variant` prop matches AdminMenu's so the pill reads correctly on
 * both light surfaces (SiteNav) and dark surfaces (the TeaseLanding
 * gradient hero).
 */
export function SwitchToPublicViewPill({
  customDomain,
  variant = "light",
}: {
  customDomain: string | null | undefined;
  variant?: "light" | "dark";
}) {
  if (!customDomain) return null;

  const styles =
    variant === "dark"
      ? "border-white/40 text-white hover:border-white hover:bg-white/10"
      : "border-tenant-primary/40 text-tenant-primary hover:border-tenant-primary hover:bg-tenant-tint";

  return (
    <a
      href={`https://${customDomain}`}
      className={`inline-flex items-center rounded-full border bg-transparent px-3 py-1 text-xs font-medium transition ${styles}`}
    >
      Switch to public view
    </a>
  );
}
