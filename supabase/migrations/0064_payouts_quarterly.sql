-- payouts: รายเดือน → รายไตรมาส
--
-- นโยบายการจ่ายส่วนแบ่งเปลี่ยนเป็น "จ่ายทุก 3 เดือน" โอนในเดือน ม.ค./เม.ย./ก.ค./ต.ค.
-- (Q1 ม.ค.–มี.ค. โอน เม.ย. · Q2 เม.ย.–มิ.ย. โอน ก.ค. · Q3 ก.ค.–ก.ย. โอน ต.ค. ·
--  Q4 ต.ค.–ธ.ค. โอน ม.ค. ปีถัดไป — ตรงกับ payoutMonthFor ใน src/lib/revenue.ts)
--
-- 1 แถว = 1 การโอนจริง 1 ครั้ง เพื่อให้ผูกกับสลิปธนาคารและเอกสารที่ออกให้ designer
-- ได้แบบ 1:1 (ถ้าเก็บรายเดือนต่อไป การโอน 1 ครั้งจะกลายเป็น 3 แถว)

-- ── 1) เพิ่มคอลัมน์ไตรมาส แล้ว backfill จากเดือนเดิม ───────────────────────────
alter table public.payouts
  add column period_quarter int;

update public.payouts
  set period_quarter = ceil(period_month / 3.0)::int;

-- รวมแถวที่ตกไตรมาสเดียวกัน (เดิมแยกได้ถึง 3 แถวต่อไตรมาส) — เก็บแถวที่ paid_at
-- เก่าสุดไว้เป็นตัวแทน บวกยอดของแถวที่เหลือเข้าไป แล้วลบแถวซ้ำทิ้ง
-- ตอนเขียน migration นี้ระบบยังไม่มี payout จริงสักแถว (no-op) — เขียนกันไว้เผื่อ
with ranked as (
  select id, designer_id, period_year, period_quarter, amount, note,
         row_number() over (
           partition by designer_id, period_year, period_quarter
           order by paid_at, id
         ) as rn
  from public.payouts
),
merged as (
  select designer_id, period_year, period_quarter,
         sum(amount) as total_amount,
         string_agg(note, ' | ') filter (where note is not null) as merged_note
  from ranked
  group by designer_id, period_year, period_quarter
  having count(*) > 1
)
update public.payouts p
   set amount = m.total_amount,
       note = m.merged_note
  from merged m
 where p.designer_id = m.designer_id
   and p.period_year = m.period_year
   and p.period_quarter = m.period_quarter
   and p.id = (
     select r.id from ranked r
      where r.designer_id = m.designer_id
        and r.period_year = m.period_year
        and r.period_quarter = m.period_quarter
        and r.rn = 1
   );

delete from public.payouts p
 where exists (
   select 1 from public.payouts q
    where q.designer_id = p.designer_id
      and q.period_year = p.period_year
      and q.period_quarter = p.period_quarter
      and (q.paid_at, q.id) < (p.paid_at, p.id)
 );

-- ── 2) สลับ unique constraint เดือน → ไตรมาส ────────────────────────────────
alter table public.payouts
  drop constraint payouts_designer_id_period_year_period_month_key;

alter table public.payouts
  drop column period_month;

alter table public.payouts
  alter column period_quarter set not null,
  add constraint payouts_period_quarter_check check (period_quarter between 1 and 4),
  add constraint payouts_designer_period_quarter_key
    unique (designer_id, period_year, period_quarter);

-- RLS policy เดิม ("admin all payouts" / "designer read own payouts") อ้างเฉพาะ
-- designer_id กับ get_my_role() จึงไม่ต้องแก้ตาม
