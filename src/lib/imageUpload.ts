import { supabase } from "@/integrations/supabase/client";

// Long-lived signed URL (1 year). Works even for private buckets.
const YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ImageBucket = "listings" | "avatars" | "ads";

export async function uploadImage(
  bucket: ImageBucket,
  userId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, YEAR_SECONDS);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Gagal membuat URL gambar");
  return data.signedUrl;
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File harus berupa gambar.";
  if (file.size > 5 * 1024 * 1024) return "Ukuran gambar maksimal 5MB.";
  return null;
}
