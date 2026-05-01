import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Reunion } from "@/lib/db/schema";
import { getCurrentAdminContext } from "@/lib/admin-auth";

type SiteMode = Reunion["siteMode"];

export const SITE_MODES: readonly SiteMode[] = [
  "tease",
  "pre_register",
  "open",
] as const;

export const ADMIN_PREVIEW_COOKIE = "admin_preview_mode";

export type AdminPreviewState = {
  isAdmin: boolean;
  /** Mode the admin has explicitly chosen to preview, if any. */
  previewMode: SiteMode | null;
  /** The reunion's DB-level siteMode — what the public sees. */
  actualMode: SiteMode;
  /** Mode the page should render as. */
  effectiveMode: SiteMode;
};

/**
 * Resolve admin auth + preview-mode override + actual DB mode in one shot.
 *
 * **Auth migration (May 2026):** admin auth moved from a single-password
 * cookie (`admin_auth` === ADMIN_PASSWORD) to Clerk-based auth with a
 * two-tier role model (super admins via env var; reunion admins via DB
 * table). `isAdmin` here means "is super OR is a reunion admin for THIS
 * reunion."
 *
 * **Default behavior (unchanged):** admins see the public view by default.
 * Setting the `admin_preview_mode` cookie via /api/admin/preview-mode opts
 * an admin into previewing a different mode.
 *
 * **Performance:** this function runs on every public reunion page render.
 * `getCurrentAdminContext()` short-circuits to null for signed-out visitors
 * (zero DB / Backend API calls) and reads email from `sessionClaims.email`
 * for signed-in users (no Clerk Backend API call). Do NOT switch this to
 * `currentUser()` — that would burn rate limits on public traffic.
 */
export async function getAdminPreviewState(
  reunion: Reunion
): Promise<AdminPreviewState> {
  const cookieStore = await cookies();
  const ctx = await getCurrentAdminContext();
  const isAdmin =
    !!ctx && (ctx.isSuper || ctx.reunionIds.includes(reunion.id));

  let previewMode: SiteMode | null = null;
  if (isAdmin) {
    const cookieMode = cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value;
    if (
      cookieMode === "tease" ||
      cookieMode === "pre_register" ||
      cookieMode === "open"
    ) {
      previewMode = cookieMode;
    }
  }

  return {
    isAdmin,
    previewMode,
    actualMode: reunion.siteMode,
    effectiveMode: previewMode ?? reunion.siteMode,
  };
}

/**
 * Get the effective site mode for rendering.
 * Public visitors get the DB siteMode. Admins get the same unless they have
 * an active preview override.
 */
export async function getEffectiveSiteMode(
  reunion: Reunion
): Promise<SiteMode> {
  const state = await getAdminPreviewState(reunion);
  return state.effectiveMode;
}

export async function assertSiteMode(
  reunionId: string,
  allowedModes: SiteMode[]
): Promise<Reunion> {
  const reunion = await db
    .select()
    .from(reunions)
    .where(eq(reunions.id, reunionId))
    .get();

  if (!reunion) {
    throw new Error("Reunion not found");
  }

  const effectiveMode = await getEffectiveSiteMode(reunion);

  if (!allowedModes.includes(effectiveMode)) {
    throw new Error(
      `Action not available in ${reunion.siteMode} mode. Required: ${allowedModes.join(" or ")}`
    );
  }

  return reunion;
}

export async function getReunionBySlug(slug: string) {
  return db
    .select()
    .from(reunions)
    .where(eq(reunions.slug, slug))
    .get();
}
