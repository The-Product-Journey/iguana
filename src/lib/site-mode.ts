import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Reunion } from "@/lib/db/schema";

type SiteMode = Reunion["siteMode"];

/**
 * Check if the current request has admin preview access.
 * When an admin is logged in, the site behaves as if siteMode is "open".
 */
export async function isAdminPreview(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const auth = cookieStore.get("admin_auth");
    return auth?.value === process.env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

/**
 * Get the effective site mode — "open" if admin is previewing,
 * otherwise the reunion's actual siteMode.
 */
export async function getEffectiveSiteMode(
  reunion: Reunion
): Promise<SiteMode> {
  const preview = await isAdminPreview();
  return preview ? "open" : reunion.siteMode;
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
