import { createClient } from "@supabase/supabase-js";
import DesignerDetail from "./DesignerDetail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateStaticParams() {
  // designer_profiles (view สาธารณะ, 0054) แทน users ตรง ๆ — build ด้วย anon key
  // และ anon ไม่มีสิทธิ์ select ตาราง users อีกต่อไปหลัง 0054
  const { data } = await supabase
    .from("designer_profiles")
    .select("designer_slug");

  return (data ?? [])
    .filter((u) => u.designer_slug)
    .map((u) => ({ designer: u.designer_slug as string }));
}

export default function DesignerPage() {
  return <DesignerDetail />;
}
