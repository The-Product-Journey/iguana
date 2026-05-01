/**
 * Server component that emits per-tenant CSS variables on the public
 * reunion shell. Read by Tailwind utility classes such as
 * `bg-[color:var(--brand-primary)]` and
 * `text-[color:var(--brand-primary)]` in pages converted off the baked
 * red palette (Phase 3.10 sweep — bounded list, not exhaustive).
 *
 * Mounted once per public reunion render via `src/app/[slug]/layout.tsx`.
 * Inline `<style>` is intentional: the values change per request based
 * on the tenant's row, so they can't live in `globals.css`.
 */
import { getTenantConfig } from "@/lib/tenant-config";
import type { Reunion } from "@/lib/db/schema";

export function TenantBrandStyle({ reunion }: { reunion: Reunion }) {
  const config = getTenantConfig(reunion);
  // Scoped to a class to avoid leaking into admin chrome that intentionally
  // keeps its current red palette. The `[slug]/layout.tsx` wraps tenant
  // content in <div className="tenant-brand">…</div>.
  const css = `.tenant-brand{--brand-primary:${config.brandColorPrimary};--brand-primary-dark:${config.brandColorPrimaryDark};}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
