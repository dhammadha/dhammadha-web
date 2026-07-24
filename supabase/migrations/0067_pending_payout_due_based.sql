-- badge เมนู Payouts = designer ที่มีไตรมาส "ถึงรอบโอนแล้ว" (รอโอน + ค้างชำระ) ยังไม่ได้โอน
-- 0066 นับ all-time outstanding (รวมไตรมาสปัจจุบันที่ยังไม่ถึงรอบ = "ยังไม่ถึงรอบโอน") ซึ่งไม่ตรง
-- กับสถานะที่เจ้าของต้องการ → คืนมาเป็น due-based (เหมือน 0065): unpaid quarter ที่ current_date
-- >= เดือนรอบโอน เท่านั้น
-- หมายเหตุ: คิดจาก Retail (checkout) เท่านั้น (sub=0) — เพิ่ม subscription share เมื่อ Phase 4.1 live
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
             sum(coalesce(o.designer_amount, o.total_amount * 0.75)) as designer_amount
        from public.orders o
       where o.status = 'paid' and o.source = 'checkout' and o.designer_id is not null
       group by 1, 2, 3
    )
    select count(distinct q.designer_id)::int
      from per_quarter q
     where q.designer_amount > 0
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

revoke all on function public.pending_payout_designer_count() from public;
revoke all on function public.pending_payout_designer_count() from anon;
grant execute on function public.pending_payout_designer_count() to authenticated;
