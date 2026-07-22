import { supabase } from "@/lib/supabase";

// ห้ามใช้ PostgREST embedding — fonts กับ designer_promotions ไม่มี FK ตรงถึงกัน
// (ดู comment เดียวกันใน src/app/fonts/[designer]/[slug]/page.tsx fetchDesignerMap)
// จึงใช้ query แยก + merge ฝั่ง client

/** ผูกโปรร้าน (designer_promotions) เข้ากับรายการฟอนต์ตาม owner_id — ใช้ร่วมกันทุกหน้าที่แสดงรายการฟอนต์ */
export async function mergeShopPromos<T extends { owner_id?: string | null }>(
  fonts: T[]
): Promise<(T & { shop_discount_percent?: number | null; shop_sale_end?: string | null })[]> {
  const ids = Array.from(new Set(fonts.map((f) => f.owner_id).filter(Boolean))) as string[];
  if (ids.length === 0) return fonts;

  // fetch fail = ไม่มีโปรร้าน — fail ไปทางราคาเต็ม ไม่มีทาง undercharge
  // PostgREST cap 1000 แถวต่อ query — พอสำหรับจนกว่าจะมีนักออกแบบเกิน 1000 คนในหน้าเดียว
  const { data, error } = await supabase
    .from("designer_promotions")
    .select("designer_id, discount_percent, sale_end")
    .in("designer_id", ids);

  if (error || !data) return fonts;

  const promoMap = new Map(data.map((p) => [p.designer_id as string, p]));

  return fonts.map((f) => {
    const promo = f.owner_id ? promoMap.get(f.owner_id) : undefined;
    return promo
      ? { ...f, shop_discount_percent: promo.discount_percent, shop_sale_end: promo.sale_end }
      : f;
  });
}
