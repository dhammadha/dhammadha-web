-- โปรโมชั่นระดับร้าน (shop-wide) ของ designer — layer แยกจาก fonts.is_sale/sale_* (รายฟอนต์)
-- ห้ามเขียนทับกัน: ตอนแสดง/คิดเงินใช้ effectiveSale ใน src/lib/sale.ts (shop ชนะเมื่อ active)
CREATE TABLE IF NOT EXISTS public.designer_promotions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  sale_end         date NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id)
);

CREATE TRIGGER designer_promotions_updated_at
  BEFORE UPDATE ON public.designer_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.designer_promotions ENABLE ROW LEVEL SECURITY;

-- designer อ่าน/แก้ได้เฉพาะของตัวเอง
CREATE POLICY "designer manage own promotions"
  ON public.designer_promotions
  USING (designer_id = auth.uid())
  WITH CHECK (designer_id = auth.uid());

-- admin อ่านได้ทั้งหมด
CREATE POLICY "admin read all promotions"
  ON public.designer_promotions FOR SELECT
  USING (public.get_my_role() = 'admin');

-- ทุกคน (anon) อ่านได้ เพื่อคำนวณราคาโชว์หน้าเว็บ + checkout ฝั่ง server (anon key)
CREATE POLICY "public read promotions"
  ON public.designer_promotions FOR SELECT
  USING (true);

-- RLS policy อย่างเดียวไม่พอ — ต้อง GRANT สิทธิ์ตารางตรง ๆ ด้วย (gotcha เดิมของโปรเจกต์)
GRANT SELECT ON public.designer_promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.designer_promotions TO authenticated;
