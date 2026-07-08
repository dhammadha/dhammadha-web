-- Phase A: สร้าง table เก็บ licensing config ของแต่ละ designer
CREATE TABLE IF NOT EXISTS public.designer_license_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  use_default  boolean NOT NULL DEFAULT true,
  license_pdf_url text,
  tiers        jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id)
);

CREATE TRIGGER designer_license_config_updated_at
  BEFORE UPDATE ON public.designer_license_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.designer_license_config ENABLE ROW LEVEL SECURITY;

-- designer อ่าน/แก้ได้เฉพาะของตัวเอง
CREATE POLICY "designer manage own license config"
  ON public.designer_license_config
  USING (designer_id = auth.uid())
  WITH CHECK (designer_id = auth.uid());

-- admin อ่านได้ทั้งหมด
CREATE POLICY "admin read all license configs"
  ON public.designer_license_config FOR SELECT
  USING (public.get_my_role() = 'admin');

-- ทุกคน (anon) อ่านได้ เพื่อแสดงใน quote form และ designer slug page
CREATE POLICY "public read license configs"
  ON public.designer_license_config FOR SELECT
  USING (true);

GRANT SELECT ON public.designer_license_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.designer_license_config TO authenticated;
