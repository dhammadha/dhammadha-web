-- Phase A: เพิ่ม columns สำหรับ designer application flow
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS designer_application_status text
    CHECK (designer_application_status IN ('pending', 'approved', 'rejected'));
