import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import FontDetail from "./FontDetail";
import type { Font } from "@/components/FontCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RawFont = { users?: { designer_slug?: string; business_name?: string } | null } & Record<string, unknown>;

function flattenFont(r: RawFont): Font {
  return {
    ...(r as unknown as Font),
    designer_slug: r.users?.designer_slug ?? undefined,
    designer_business_name: r.users?.business_name ?? undefined,
  };
}

export async function generateStaticParams() {
  const { data } = await supabase
    .from("fonts")
    .select("slug, users!owner_id(designer_slug)")
    .eq("is_active", true);

  return (data ?? []).map((f) => {
    const raw = f as { slug: string; users?: { designer_slug?: string } | null };
    return {
      designer: raw.users?.designer_slug ?? "_",
      slug: raw.slug ?? "_",
    };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("fonts")
    .select("name, name_th, description_th, cover_image_url")
    .eq("slug", slug)
    .eq("is_active", true)
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
    .select("*, users!owner_id(designer_slug, business_name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  const initialFont = data ? flattenFont(data as RawFont) : null;

  return <FontDetail initialFont={initialFont} />;
}
