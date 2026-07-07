import { createClient } from "@supabase/supabase-js";
import DesignerDetail from "./DesignerDetail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateStaticParams() {
  const { data } = await supabase
    .from("users")
    .select("designer_slug")
    .not("designer_slug", "is", null);

  return (data ?? [])
    .filter((u) => u.designer_slug)
    .map((u) => ({ designer: u.designer_slug as string }));
}

export default function DesignerPage() {
  return <DesignerDetail />;
}
