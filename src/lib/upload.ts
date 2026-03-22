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
