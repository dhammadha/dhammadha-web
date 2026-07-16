-- Phase 4.1 — RPC คำนวณข้อมูลแบ่งรายได้ subscription รายเดือน
--
-- คืน "aggregate ปลอดภัย" (ไม่มีตัวตน user รายคน) ให้ทั้ง admin และ designer เรียกได้
-- ตรรกะเงิน (แบ่ง 50/12/38, ปัดเศษ) ทำใน src/lib/subscription-revenue.ts ตามแบบ revenue.ts
--
-- โมเดล: revenue เดือนนั้น → เว็บ 50% | equal pool 12% | stream pool 38%
--   equal pool  ÷ จำนวนฟอนต์ opt-in → เจ้าของฟอนต์
--   stream pool แบ่งตาม stream_share ซึ่ง normalize แบบ user-centric:
--     - subscriber แต่ละคนน้ำหนัก = 1 เท่ากัน (กัน activate-all / ปั๊มยอด)
--     - น้ำหนักของแต่ละคนหารตามสัดส่วน font-days ของเขาเอง
--     - รวมข้ามทุกคน → หารด้วยจำนวนคน → sum(stream_share ทุกฟอนต์) = 1
--
-- นับเดือน: subscription ที่ช่วง [started_at, current_period_end) คาบเกี่ยวเดือนนั้น
--   → นับ price_amount เข้า revenue (trial = 0). ตัดบัญชี admin ออกจากทั้ง revenue
--   และ font-days (แต่ฟอนต์ที่ owner เป็น admin ยังอยู่ใน pool ปกติ)
-- เวลาอ้างอิง Asia/Bangkok (stream_days.day เก็บวันไทยอยู่แล้ว)

create or replace function public.subscription_month_data(p_year int, p_month int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := make_date(p_year, p_month, 1);
  v_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date; -- exclusive
  v_users int;
  v_result jsonb;
begin
  if public.get_my_role() not in ('admin', 'designer') then
    raise exception 'forbidden';
  end if;

  -- font-days ต่อ (user, font) ของเดือนนั้น ตัด admin ออก
  create temp table _sd on commit drop as
    select d.user_id, d.font_id, count(*)::numeric as days
    from public.stream_days d
    join public.users u on u.id = d.user_id
    where u.role <> 'admin'
      and d.day >= v_start and d.day < v_end
    group by d.user_id, d.font_id;

  -- total font-days ต่อ user (ตัวหารของ user-centric)
  create temp table _ut on commit drop as
    select user_id, sum(days) as total from _sd group by user_id;

  select count(*) into v_users from _ut;

  -- stream_share ต่อฟอนต์ = sum_over_users( days(u,f)/total(u) ) / v_users
  create temp table _w on commit drop as
    select s.font_id,
           case when v_users > 0
                then sum( (s.days / ut.total) ) / v_users
                else 0 end as stream_share,
           sum(s.days) as font_days
    from _sd s
    join _ut ut on ut.user_id = s.user_id
    group by s.font_id;

  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'revenue', coalesce((
      select sum(s.price_amount)
      from public.subscriptions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end::timestamptz
        and s.current_period_end > v_start::timestamptz
    ), 0),
    'subscriber_count', coalesce((
      select count(*)
      from public.subscriptions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end::timestamptz
        and s.current_period_end > v_start::timestamptz
    ), 0),
    'contributing_users', v_users,
    -- ฟอนต์ที่ opt-in (snapshot ณ เวลาคำนวณ) พร้อม stream_share/font_days ถ้ามี
    'opted_fonts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'font_id', f.id,
        'name', coalesce(f.name, f.name_th),
        'owner_id', f.owner_id,
        'stream_share', coalesce(w.stream_share, 0),
        'font_days', coalesce(w.font_days, 0)
      ))
      from public.fonts f
      left join _w w on w.font_id = f.id
      where f.is_subscription = true and f.is_active = true and f.owner_id is not null
    ), '[]'::jsonb),
    -- ฟอนต์ที่ opt-out ไปแล้วแต่ยังมี font-days ในเดือนนั้น (ยังจ่ายส่วน stream ให้เจ้าของ)
    'orphan_stream', coalesce((
      select jsonb_agg(jsonb_build_object(
        'font_id', w.font_id,
        'name', coalesce(f.name, f.name_th),
        'owner_id', f.owner_id,
        'stream_share', w.stream_share,
        'font_days', w.font_days
      ))
      from _w w
      left join public.fonts f on f.id = w.font_id
      where w.stream_share > 0
        and w.font_id not in (
          select id from public.fonts
          where is_subscription = true and is_active = true and owner_id is not null
        )
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.subscription_month_data(int, int) from public, anon;
grant execute on function public.subscription_month_data(int, int) to authenticated;
