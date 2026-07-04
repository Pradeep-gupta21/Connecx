import { supabase } from "@/integrations/supabase/client";

export const PROFILE_PICTURES_BUCKET = "profile-pictures";
export const PROFILE_BANNERS_BUCKET = "profile-banners";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const BANNER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type BannerPosition = { x: number; y: number; zoom: number };
export const DEFAULT_BANNER_POSITION: BannerPosition = { x: 50, y: 50, zoom: 1 };

/**
 * Resolve a stored profile media value to a usable URL.
 * - http(s) URLs (legacy / OAuth avatars) are returned as-is
 * - storage paths are resolved to a signed URL
 */
export async function resolveProfileMediaUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(value, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function validateImageFile(
  file: File,
  { maxBytes, kind }: { maxBytes: number; kind: "avatar" | "banner" },
): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, PNG or WEBP images are allowed.";
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `${kind === "avatar" ? "Profile picture" : "Cover banner"} must be under ${mb} MB.`;
  }
  return null;
}

export async function uploadProfileMedia(
  bucket: string,
  userId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function removeProfileMediaByPath(bucket: string, storedValue: string | null) {
  if (!storedValue || /^https?:\/\//i.test(storedValue)) return;
  await supabase.storage.from(bucket).remove([storedValue]);
}
