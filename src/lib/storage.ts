import { supabase } from "./supabase";

export type StorageBucket = "covers" | "previews" | "specimens" | "fonts-demo" | "fonts-free" | "fonts-full";

export async function uploadFile(bucket: StorageBucket, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// สำหรับ bucket ที่เป็น private (fonts-full) — คืน storage path แทน public URL
// การดาวน์โหลดจริงจะออก signed URL ตอนตรวจสิทธิ์แล้วเท่านั้น (Phase 2)
export async function uploadProtectedFile(bucket: StorageBucket, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}

export function slugifyFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]/g, "_");
}

export function storagePath(fontSlug: string, bucket: StorageBucket, filename: string): string {
  return `${fontSlug}/${slugifyFilename(filename)}`;
}
