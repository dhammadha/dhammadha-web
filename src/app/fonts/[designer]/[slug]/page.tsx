import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import FontDetail from "./FontDetail";
import type { Font } from "@/components/FontCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RawFont = Record<string, unknown> & { owner_id?: string | null };

// designer_profiles เป็น view (0054) ไม่มี foreign key จาก fonts.owner_id ไปหา view นั้น
// (FK ผูกกับตาราง users เดิม) เลย embed แบบ `users!owner_id(...)` ของ PostgREST ใช้ไม่ได้
// กับ view — ต้อง query แยก 2 รอบแล้ว merge เอาเองฝั่ง JS แทน
async function fetchDesignerMap(ownerIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(ownerIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map<string, { designer_slug?: string; business_name?: string }>();
  const { data } = await supabase
    .from("designer_profiles")
    .select("id, designer_slug, business_name")
    .in("id", ids);
  return new Map(
    (data ?? []).map((d) => [d.id as string, { designer_slug: d.designer_slug ?? undefined, business_name: d.business_name ?? undefined }])
  );
}

function flattenFont(r: RawFont, designer?: { designer_slug?: string; business_name?: string }): Font {
  return {
    ...(r as unknown as Font),
    designer_slug: designer?.designer_slug ?? undefined,
    designer_business_name: designer?.business_name ?? undefined,
  };
}

export async function generateStaticParams() {
  const { data } = await supabase
    .from("fonts")
    .select("slug, owner_id")
    .eq("is_active", true);

  const fontsData = (data ?? []) as { slug: string; owner_id: string | null }[];
  const designerMap = await fetchDesignerMap(fontsData.map((f) => f.owner_id));

  return fontsData.map((f) => ({
    designer: (f.owner_id && designerMap.get(f.owner_id)?.designer_slug) || "_",
    slug: f.slug ?? "_",
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("fonts")
    .select("name, name_th, description_th, cover_image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .not("published_at", "is", null)
    .single();

  if (!data) return { title: "ฟอนต์ไทย — DHAMMADHA STUDIO" };

  const d = data as { name?: string; name_th?: string; description_th?: string; cover_image_url?: string };
  const title = `${d.name_th || d.name} — DHAMMADHA STUDIO`;
  const description = d.description_th || `ฟอนต์ไทยคุณภาพสูง ${d.name_th || d.name} โดย DHAMMADHA STUDIO`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: d.cover_image_url ? [{ url: d.cover_image_url }] : [],
    },
  };
}

export default async function FontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await supabase
    .from("fonts")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .not("published_at", "is", null)
    .single();

  const raw = data as RawFont | null;
  const designerMap = raw ? await fetchDesignerMap([raw.owner_id]) : new Map();
  const initialFont = raw ? flattenFont(raw, raw.owner_id ? designerMap.get(raw.owner_id) : undefined) : null;

  return <FontDetail initialFont={initialFont} />;
}
