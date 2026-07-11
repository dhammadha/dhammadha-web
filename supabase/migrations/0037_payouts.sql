-- Phase 4.2 — Revenue & Payout
-- ตาราง payouts บันทึกการโอนเงินจริง (manual bank transfer) ให้ designer
-- แอดมินโอนเงินนอกระบบ (สลิปธนาคาร) แล้วมาบันทึกไว้ 1 แถวต่อ designer ต่อเดือน
-- เพื่อ mark ว่าเดือนนั้น "จ่ายแล้ว" — ไม่ได้ผูกกับ payment gateway ใด ๆ
--
-- หมายเหตุ: period_year/period_month เก็บเป็น ค.ศ./1-12 ตามมาตรฐานคอลัมน์วันที่
-- อื่น ๆ ในระบบ (paid_at, created_at) ส่วน UI จะแปลงเป็น พ.ศ. ด้วย th-TH locale
-- ตอนแสดงผล (ดู monthLabel ใน src/lib/revenue.ts) — ไม่ได้เก็บ พ.ศ. ตรง ๆ ในนี้
-- เพื่อให้เทียบ/บวกลบเดือนกับ orders.paid_at ได้ตรงไปตรงมา

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.users(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  amount numeric not null check (amount >= 0),
  -- เลขอ้างอิงสลิปโอนเงิน/หมายเหตุอื่น ๆ ของแอดมิน
  note text,
  paid_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- โอนได้ครั้งเดียวต่อ designer ต่อเดือน (กันบันทึกซ้ำ)
  unique (designer_id, period_year, period_month)
);

alter table public.payouts enable row level security;

-- แอดมินจัดการได้ทุกอย่าง (บันทึก/แก้ไข/ลบการโอน)
-- ใช้ get_my_role() = 'admin' ตรง ๆ ใน policy ปลอดภัย (ไม่เหมือนใน plpgsql if):
-- ถ้า get_my_role() คืน null, null = 'admin' ได้ null ซึ่ง RLS ถือเป็น false
-- (เทียบกับ 0035/0036 ที่ปัญหาเกิดเฉพาะตอนใช้ <> ใน if ของ plpgsql)
create policy "admin all payouts"
  on public.payouts for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- designer อ่านได้เฉพาะประวัติการโอนของตัวเอง (หน้า revenue ฝั่ง designer)
create policy "designer read own payouts"
  on public.payouts for select
  using (designer_id = auth.uid());

-- grant ให้ authenticated เท่านั้น (policy ข้างบนคุมสิทธิ์เขียนให้เหลือแค่แอดมิน)
-- ห้าม grant ให้ anon — ข้อมูลรายได้ไม่ควรเปิดสาธารณะ
grant select, insert, update, delete on public.payouts to authenticated;
