-- badge "Payouts" ในเมนู admin — จำนวน designer ที่ถึงรอบโอนแล้วแต่ยังไม่ได้บันทึกจ่าย
--
-- ทำเป็น RPC เพราะถ้าให้หน้า layout คำนวณเอง ต้องดึง orders ทั้งตารางมา group
-- ฝั่ง client ทุกครั้งที่เปิดหน้า admin หน้าไหนก็ตาม

create or replace function public.pending_payout_designer_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case when public.get_my_role() = 'admin' then (
    with per_quarter as (
      select o.designer_id,
             extract(year from coalesce(o.paid_at, o.created_at))::int as period_year,
             ceil(extract(month from coalesce(o.paid_at, o.created_at))::numeric / 3)::int as period_quarter,
             -- designer_amount ถูกบันทึกไว้ ณ เวลาขายแล้ว — fallback 75% ให้ตรงกับ
             -- PLATFORM_RATE_FALLBACK ใน src/lib/revenue.ts เผื่อข้อมูลผิดปกติ
             sum(coalesce(o.designer_amount, o.total_amount * 0.75)) as designer_amount
        from public.orders o
       where o.status = 'paid'
         and o.source = 'checkout'
         and o.designer_id is not null
       group by 1, 2, 3
    )
    select count(distinct q.designer_id)::int
      from per_quarter q
     where q.designer_amount > 0
       -- ถึงเดือนที่ต้องโอนแล้ว (Q4 โอน ม.ค. ปีถัดไป, ที่เหลือโอนเดือนถัดจากจบไตรมาส)
       and current_date >= make_date(
             case when q.period_quarter = 4 then q.period_year + 1 else q.period_year end,
             case when q.period_quarter = 4 then 1 else q.period_quarter * 3 + 1 end,
             1)
       and not exists (
             select 1 from public.payouts p
              where p.designer_id = q.designer_id
                and p.period_year = q.period_year
                and p.period_quarter = q.period_quarter
           )
  ) else 0 end;
$$;

-- Postgres grant execute ให้ PUBLIC อัตโนมัติตอน create function — ต้อง revoke ทิ้ง
-- ก่อนเสมอ ไม่งั้น anon เรียกได้ (ฟังก์ชันนี้เป็น security definer = ข้าม RLS)
revoke all on function public.pending_payout_designer_count() from public;
revoke all on function public.pending_payout_designer_count() from anon;
grant execute on function public.pending_payout_designer_count() to authenticated;
