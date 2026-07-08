-- Phase A: ผูก quote กับ designer ที่เป็นเจ้าของฟอนต์
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS designer_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- designer อ่านได้เฉพาะ quote ที่ส่งมาหาตัวเอง
CREATE POLICY "designer read own quotes"
  ON public.quotes FOR SELECT
  USING (designer_id = auth.uid());

-- admin อ่านได้ทั้งหมด (policy เดิมอาจมีอยู่แล้ว ถ้าไม่มีให้เพิ่ม)
DO $$ BEGIN
  CREATE POLICY "admin read all quotes"
    ON public.quotes FOR SELECT
    USING (public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.quotes TO authenticated;
