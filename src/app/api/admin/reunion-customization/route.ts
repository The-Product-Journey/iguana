import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireReunionAdmin } from "@/lib/admin-auth";
import { uploadFavicon } from "@/lib/upload";
import { invalidateTenantDomainsCache } from "@/lib/tenant-domains";

// Hostname pattern: labels separated by dots, each label is letters/digits/
// hyphens (not starting/ending with hyphen), TLD ≥ 2 chars. No protocol,
// no path, no port. Lowercased before validation.
const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Save per-reunion site customization (vanity domain + favicon).
 *
 * Accepts multipart/form-data so the favicon file can come along in one
 * request alongside text fields. All fields are optional individually:
 * sending only `customDomain` updates just that, sending only `faviconFile`
 * updates just that.
 *
 * Special values:
 *   - customDomain="" or "null" → clear the field (set to NULL in DB)
 *   - faviconUrl field is read-only via this endpoint; clearing the favicon
 *     happens by sending a separate `clearFavicon=true` form field.
 *
 * Domain conflict: 409 if another reunion already owns the requested
 * customDomain. The unique index on the column also enforces this at the
 * DB layer as a defense-in-depth.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const reunionId = (formData.get("reunionId") as string | null)?.trim();
  if (!reunionId) {
    return NextResponse.json({ error: "Missing reunionId" }, { status: 400 });
  }

  const guard = await requireReunionAdmin(reunionId);
  if (guard instanceof NextResponse) return guard;

  const updates: {
    customDomain?: string | null;
    faviconUrl?: string | null;
    brandColor?: string | null;
  } = {};

  // customDomain — text field. Empty string or "null" sentinel clears it.
  if (formData.has("customDomain")) {
    const raw = (formData.get("customDomain") as string).trim().toLowerCase();
    if (raw === "" || raw === "null") {
      updates.customDomain = null;
    } else {
      if (!HOSTNAME_RE.test(raw)) {
        return NextResponse.json(
          {
            error:
              "Invalid domain. Enter a hostname like `example.com` — no protocol, path, or port.",
          },
          { status: 400 }
        );
      }
      // Conflict check: another reunion can't already own this domain.
      const existing = await db
        .select({ id: reunions.id })
        .from(reunions)
        .where(
          and(eq(reunions.customDomain, raw), ne(reunions.id, reunionId))
        )
        .get();
      if (existing) {
        return NextResponse.json(
          {
            error:
              "That domain is already attached to another reunion. Each domain can only point to one reunion.",
          },
          { status: 409 }
        );
      }
      updates.customDomain = raw;
    }
  }

  // brandColor — hex value, "" or "null" clears (back to platform default).
  // Always normalized to uppercase so the DB doesn't store mixed-case dupes.
  if (formData.has("brandColor")) {
    const raw = (formData.get("brandColor") as string).trim();
    if (raw === "" || raw === "null") {
      updates.brandColor = null;
    } else if (!HEX_COLOR_RE.test(raw)) {
      return NextResponse.json(
        { error: "Invalid color. Use a 6-digit hex value like `#B91C1C`." },
        { status: 400 }
      );
    } else {
      updates.brandColor = raw.toUpperCase();
    }
  }

  // Favicon — file upload OR explicit clear
  if (formData.has("clearFavicon") && formData.get("clearFavicon") === "true") {
    updates.faviconUrl = null;
  } else if (formData.has("faviconFile")) {
    const file = formData.get("faviconFile") as File | null;
    if (file && file.size > 0) {
      try {
        updates.faviconUrl = await uploadFavicon(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Favicon upload failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noChange: true });
  }

  try {
    await db
      .update(reunions)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(reunions.id, reunionId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.includes("idx_reunions_custom_domain")) {
      return NextResponse.json(
        { error: "That domain is already attached to another reunion." },
        { status: 409 }
      );
    }
    console.error("[reunion-customization] update failed", err);
    return NextResponse.json(
      { error: "Failed to save customization." },
      { status: 500 }
    );
  }

  // Bust the tenant-domain cache so the next request sees the new domain
  // immediately instead of waiting for the TTL to roll over.
  invalidateTenantDomainsCache();

  return NextResponse.json({ ok: true, ...updates });
}
