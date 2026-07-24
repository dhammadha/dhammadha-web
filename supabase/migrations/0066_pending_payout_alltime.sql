-- ยอดค้างโอน = ยอดสะสมทั้งหมดที่ยังไม่โอน (all-time) ไม่ใช่เฉพาะไตรมาสที่ครบรอบ
-- เดิม (0065) นับเฉพาะไตรมาสที่ถึงรอบโอนแล้ว → ยอดค้างเก่าที่ยังไม่โอนหล่นหายจาก badge
-- ใหม่: badge = จำนวน designer ที่ earned(Retail all-time) − paid(all-time) > 0
--
-- หมายเหตุ: คิดจาก Retail (checkout) เท่านั้น — subscription ยังไม่มีข้อมูลจริง (Phase 4.1 พัก)
-- เมื่อ sub live แล้ว payout.amount จะรวม sub ด้วย ต้องบวก sub share เข้า earned ให้ตรงกัน
create or replace function public.pending_payout_designer_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case when public.get_my_role() = 'admin' then (
    with earned as (
      select o.designer_id,
             sum(coalesce(o.designer_amount, o.total_amount * 0.75)) as amt
        from public.orders o
       where o.status = 'paid' and o.source = 'checkout' and o.designer_id is not null
       group by 1
    ),
    paid as (
      select p.designer_id, sum(p.amount) as amt
        from public.payouts p
       group by 1
    )
    select count(*)::int
      from earned e
      left join paid p on p.designer_id = e.designer_id
     where e.amt - coalesce(p.amt, 0) > 0.005
  ) else 0 end;
$$;

revoke all on function public.pending_payout_designer_count() from public;
revoke all on function public.pending_payout_designer_count() from anon;
grant execute on function public.pending_payout_designer_count() to authenticated;
