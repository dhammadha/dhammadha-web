import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Generated at build time (static export) — รายการฟอนต์/designer มาจากข้อมูล
// ตอน build ซึ่งตรงกับหน้าที่ SSG ไว้พอดี (publish ใหม่ = rebuild = sitemap ใหม่)
const BASE_URL = "https://www.dhammadha.com";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/fonts/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/agreement/`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/quote/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/subscribe/`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const { data } = await supabase
    .from("fonts")
    // embed ผ่าน view designer_profiles ไม่ใช่ users (ดู 0054 — anon อ่าน users ไม่ได้แล้ว
    // sitemap gen ตอน build ด้วย anon key ถ้า embed users จะ 401 = sitemap ว่างเปล่า)
    .select("slug, updated_at, designer_profiles!owner_id(designer_slug)")
    .eq("is_active", true)
    .not("published_at", "is", null);

  type Row = { slug: string; updated_at?: string; designer_profiles?: { designer_slug?: string } | null };
  const rows = (data ?? []) as unknown as Row[];

  const fontPages: MetadataRoute.Sitemap = rows.map((f) => ({
    url: `${BASE_URL}/fonts/${f.designer_profiles?.designer_slug ?? "_"}/${f.slug}/`,
    lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const designerSlugs = [...new Set(rows.map((f) => f.designer_profiles?.designer_slug).filter(Boolean))] as string[];
  const designerPages: MetadataRoute.Sitemap = designerSlugs.map((slug) => ({
    url: `${BASE_URL}/designer/${slug}/`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...fontPages, ...designerPages];
}
