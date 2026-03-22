import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Reunion } from "@/lib/db/schema";

type SiteMode = Reunion["siteMode"];

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

  if (!allowedModes.includes(reunion.siteMode)) {
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
