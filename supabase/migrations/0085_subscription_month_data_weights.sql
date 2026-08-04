-- ถ่วงน้ำหนักส่วนแบ่ง subscription สองเรื่องในฟังก์ชันเดียว (4 ส.ค. 2569)
--
--   A. pool 38% (ตามเวลาใช้งาน) — ฟอนต์ `is_sub_exclusive` ได้น้ำหนัก 1.25 เท่า
--   B. pool 12% (แบ่งเท่ากัน)   — เปลี่ยนจาก "หารด้วยจำนวนฟอนต์ที่เข้าร่วม ณ ตอนเรียก"
--      เป็น "เฉลี่ยตามจำนวนวันที่ฟอนต์อยู่ในแผนจริงระหว่างเดือนนั้น" (ใช้ 0084)
--
-- ทั้งสองเรื่อง **ไม่เพิ่มเงินในระบบ** — pool 50/12/38 เท่าเดิม เปลี่ยนแค่วิธีหั่น
--
-- ── กับดักที่ต้องระวังถ้ามาแก้ทีหลัง ────────────────────────────────────────
-- 🔴 ตัวคูณ 1.25 ต้องเข้าไป**ก่อน**สร้าง `_ut` (ตัวหารรายคน) เสมอ
--    เพราะ stream_share = sum(secs(u,f)/total(u))/N ซึ่งบังคับให้ผลรวมเป็น 1 พอดี
--    ถ้าคูณเฉพาะตัวเศษ ผลรวมจะเกิน 1 แล้ว `subscription-revenue.ts` ซึ่งคิดทีละฟอนต์
--    (revenue * 0.38 * share) จะจ่ายเกิน pool โดยส่วนเกินไปโผล่เป็น platformAmount
--    ติดลบ — **ไม่มี error ให้เห็น** เป็นบั๊กเงียบที่แพงที่สุดของไฟล์นี้
--    ผลพลอยได้ของการคูณก่อน normalize: ถ้าทุกฟอนต์เป็น exclusive ส่วนแบ่งเท่าเดิมเป๊ะ
--    (ตัวคูณตัดกันหมด) ซึ่งเป็นพฤติกรรมที่เจ้าของยืนยันว่าถูกต้อง
-- 🔴 `font_seconds` ที่ส่งกลับไปโชว์ต้องเป็น **วินาทีจริง (raw)** ไม่ใช่วินาทีถ่วงน้ำหนัก
--    ไม่งั้นหน้ารายได้จะรายงานเวลาใช้งานเกินความจริง 25%
-- 🔴 `opted_fonts` ยังต้องคงจำนวนแถวไว้ตอน redact ให้ designer (pad ด้วย null)
--    ตามเจตนาเดิมของ 0057
--
-- นอกจากนี้ทุกอย่างยกมาจาก 0082 ตามเดิม: ขอบเดือนเวลาไทย · ตัดบัญชี admin ·
-- session ที่ยังเปิดนับถึง heartbeat ล่าสุด · orphan_stream ยังจ่าย stream ให้ฟอนต์
-- ที่ออกจากแผนไปแล้วแต่มีการใช้งานในเดือนนั้น

create or replace function public.subscription_month_data(p_year integer, p_month integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- ขอบเดือนตามเวลาไทย (เหตุผลอยู่ใน 0082) — ใช้ค่าเดียวกันทั้ง RPC
  v_start_ts timestamptz := (make_date(p_year, p_month, 1))::timestamp
                              at time zone 'Asia/Bangkok';
  v_end_ts   timestamptz := ((make_date(p_year, p_month, 1) + interval '1 month')::timestamp)
                              at time zone 'Asia/Bangkok';
  v_users int;
  v_eq_total numeric;
  v_role text;
  v_uid uuid;
  v_result jsonb;
begin
  v_role := coalesce(public.get_my_role()::text, '');
  if v_role not in ('admin', 'designer') then
    raise exception 'forbidden';
  end if;
  v_uid := auth.uid();

  -- วินาทีที่ใช้งานจริงต่อ (user, font) ในเดือนนั้น — ตัดบัญชี admin ออก
  -- `secs` = วินาทีถ่วงน้ำหนักแล้ว (ใช้คิด share) · `raw_secs` = ของจริง (ใช้โชว์)
  -- left join fonts: ฟอนต์ที่ถูกลบไปแล้วยังนับได้เหมือนเดิม โดยถือน้ำหนัก 1
  create temp table _sd on commit drop as
    select x.user_id,
           x.font_id,
           x.raw_secs,
           x.raw_secs * case when f.is_sub_exclusive then 1.25 else 1 end as secs
    from (
      select s.user_id,
             s.font_id,
             sum(greatest(
               extract(epoch from (
                   least(coalesce(s.ended_at, s.last_seen_at), v_end_ts)
                 - greatest(s.started_at, v_start_ts)
               )),
               0
             ))::numeric as raw_secs
      from public.stream_sessions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end_ts
        and coalesce(s.ended_at, s.last_seen_at) > v_start_ts
      group by s.user_id, s.font_id
    ) x
    left join public.fonts f on f.id = x.font_id
    where x.raw_secs > 0;

  -- ตัวหารของ user-centric: เวลา (ถ่วงน้ำหนักแล้ว) รวมทุกฟอนต์ของคนนั้น
  create temp table _ut on commit drop as
    select user_id, sum(secs) as total from _sd group by user_id;

  select count(*) into v_users from _ut;

  -- stream_share ต่อฟอนต์ = sum_over_users( secs(u,f)/total(u) ) / v_users
  create temp table _w on commit drop as
    select s.font_id,
           case when v_users > 0
                then sum( (s.secs / ut.total) ) / v_users
                else 0 end as stream_share,
           sum(s.raw_secs) as font_seconds
    from _sd s
    join _ut ut on ut.user_id = s.user_id
    group by s.font_id;

  -- เวลาที่ฟอนต์ "อยู่ในแผน" ระหว่างเดือนนั้น → ตัวตั้งของ pool 12%
  -- เดือนที่ยังไม่จบ: period ที่ยังเปิดอยู่นับถึง now() ไม่ใช่ถึงสิ้นเดือน
  -- (ไม่ให้เครดิตวันที่ยังมาไม่ถึง · พอสิ้นเดือนค่าทั้งสองแบบเท่ากันเอง)
  create temp table _eq on commit drop as
    select p.font_id,
           sum(greatest(
             extract(epoch from (
                 least(coalesce(p.ended_at, now()), v_end_ts)
               - greatest(p.started_at, v_start_ts)
             )),
             0
           ))::numeric as elig_secs
    from public.font_subscription_periods p
    join public.fonts f on f.id = p.font_id
    where p.started_at < v_end_ts
      and coalesce(p.ended_at, now()) > v_start_ts
      and f.owner_id is not null
    group by p.font_id;

  delete from _eq where elig_secs <= 0;

  select coalesce(sum(elig_secs), 0) into v_eq_total from _eq;

  select jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'revenue', coalesce((
      select sum(s.price_amount)
      from public.subscriptions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end_ts
        and s.current_period_end > v_start_ts
    ), 0),
    'subscriber_count', case when v_role <> 'admin' then 0 else coalesce((
      select count(*)
      from public.subscriptions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end_ts
        and s.current_period_end > v_start_ts
    ), 0) end,
    'contributing_users', case when v_role <> 'admin' then 0 else v_users end,
    -- "ฟอนต์ที่เข้าร่วม" = มีวันอยู่ในแผนระหว่างเดือนนั้น (ไม่ใช่สถานะ ณ ตอนเรียก)
    -- ผลพลอยได้: ตัวเลขของเดือนที่ผ่านไปแล้วหยุดขยับเวลามีคน toggle
    'opted_fonts', coalesce((
      select jsonb_agg(
        case when v_role = 'admin' or f.owner_id = v_uid then
          jsonb_build_object(
            'font_id', f.id,
            'name', coalesce(f.name, f.name_th),
            'owner_id', f.owner_id,
            'equal_share', case when v_eq_total > 0 then e.elig_secs / v_eq_total else 0 end,
            'stream_share', coalesce(w.stream_share, 0),
            'font_seconds', coalesce(w.font_seconds, 0)
          )
        else
          -- คงจำนวนแถวไว้เท่าเดิมแต่ปิดข้อมูล (เจตนาเดิมจาก 0057)
          jsonb_build_object(
            'font_id', null,
            'name', null,
            'owner_id', null,
            'equal_share', 0,
            'stream_share', 0,
            'font_seconds', 0
          )
        end
      )
      from _eq e
      join public.fonts f on f.id = e.font_id
      left join _w w on w.font_id = e.font_id
    ), '[]'::jsonb),
    -- ฟอนต์ที่ไม่ได้อยู่ในแผนเลยทั้งเดือน แต่มีการใช้งาน (เช่นถูกนำออกก่อนขึ้นเดือน)
    -- ยังจ่ายส่วน stream ให้เจ้าของตามเดิม
    'orphan_stream', coalesce((
      select jsonb_agg(jsonb_build_object(
        'font_id', w.font_id,
        'name', coalesce(f.name, f.name_th),
        'owner_id', f.owner_id,
        'stream_share', w.stream_share,
        'font_seconds', w.font_seconds
      ))
      from _w w
      left join public.fonts f on f.id = w.font_id
      where w.stream_share > 0
        and w.font_id not in (select font_id from _eq)
        and (v_role = 'admin' or f.owner_id = v_uid)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- เจตนาเดิมมี grant ให้แค่ authenticated (ไม่มี anon) ยืนยันซ้ำให้ชัดเจนหลัง replace
revoke execute on function public.subscription_month_data(integer, integer) from public, anon;
grant execute on function public.subscription_month_data(integer, integer) to authenticated;
