import { put } from "@vercel/blob";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function uploadImage(
  file: File,
  folder: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: jpg, png, gif, webp, svg.`
    );
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large. Maximum size is 2MB.`);
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return blob.url;
}

/**
 * Favicon-specific upload. Accepts SVG/PNG/ICO — the formats browsers
 * actually use as favicons. Capped at 1MB. Server-side does NOT validate
 * image dimensions (square / minimum size); that happens client-side
 * before upload, keeping this handler simple and avoiding an
 * image-decoding dependency.
 */
const FAVICON_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];
const FAVICON_MAX_SIZE = 1 * 1024 * 1024; // 1MB

export async function uploadFavicon(file: File): Promise<string> {
  if (!FAVICON_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid favicon type: ${file.type}. Allowed: svg, png, ico.`
    );
  }
  if (file.size > FAVICON_MAX_SIZE) {
    throw new Error(`Favicon too large. Maximum size is 1MB.`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `favicons/${crypto.randomUUID()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return blob.url;
}
