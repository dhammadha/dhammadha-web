-- เปลี่ยนตัวคิดเงิน 38% จาก "จำนวนวัน" เป็น "ระยะเวลาจริง" (3 ส.ค. 2569)
--
-- `0081` เก็บ `stream_sessions` ไว้แล้วแต่ยังไม่ได้ใช้คิดเงิน — รอบนี้สลับมาใช้จริง
-- ตามที่เจ้าของตัดสินใจ · แก้ถ้อยคำใน `/designer-agreement` ข้อ 4 คู่กันในคอมมิตเดียวกัน
--
-- **ไม่ต้อง legal:freeze** — คนเดียวที่เซ็นสัญญาคือ montonn@outlook.com (552 Studio)
-- ซึ่งเป็นบัญชีของเจ้าของเอง ไม่มีบุคคลที่สามผูกพันกับถ้อยคำเดิม
-- และตอนนี้ subscriptions/stream_days/stream_sessions ว่างทั้งหมด = ไม่มีข้อมูลจริงให้เสียหาย
--
-- ── สิ่งที่ **ไม่** เปลี่ยน ──────────────────────────────────────────────────
-- * สูตรถ่วงน้ำหนัก user-centric `sum(x/total)/N` เหมือนเดิมทุกตัวอักษร
--   ใช้ได้ทั้งวันและวินาที · ตัวอย่างที่เจ้าของยืนยัน: A ใช้ฟอนต์เดียว 8 ชม.
--   กับ B ใช้ 10 ฟอนต์ 8 ชม. → AA ได้ 0.50 · ของ B รวมกันได้ 0.50 เท่ากัน
-- * ตรรกะ redact ทั้งหมดจาก `0057` (designer เห็นเฉพาะฟอนต์ตัวเอง แต่ `opted_fonts`
--   ต้องคงจำนวนแถวไว้เท่าเดิม เพราะ client ใช้เป็นตัวหาร equalPerFont)
-- * สัดส่วน 50/12/38 ซึ่งอยู่ฝั่ง client (`src/lib/subscription-revenue.ts`)
--
-- ── สิ่งที่เปลี่ยน ──────────────────────────────────────────────────────────
-- 1. `_sd` อ่านจาก `stream_sessions` เป็น**วินาที** แทน `stream_days` เป็นวัน
--    สูตรความยาว: `coalesce(ended_at, last_seen_at) - started_at`
--    session ที่ยังเปิดอยู่จึงนับถึง heartbeat ล่าสุด ไม่ใช่ถึง now()
--    (เดือนที่ยังไม่จบเป็นตัวเลขที่โตขึ้นเรื่อย ๆ ซึ่งถูกต้อง)
--    `least`/`greatest` ตัดขอบเดือน → session คร่อมเดือนถูกแบ่งให้ถูกเดือน
--    **ปัญหาที่ font-days ไม่เคยมี เพราะวันเป็นหน่วยไม่ต่อเนื่องอยู่แล้ว**
-- 2. `font_days` → `font_seconds` ทั้ง `opted_fonts` และ `orphan_stream`
--    (ชื่อเดิมจะกลายเป็นชื่อที่โกหก — แก้พร้อม TS ทั้งสองไฟล์ในคอมมิตเดียวกัน)
-- 3. 🔴 **ขอบเดือนยึดเวลาไทย ไม่ใช่ UTC**
--    ของเดิมเทียบกับ `stream_days.day` ซึ่งเป็นวันไทยอยู่แล้วจึงถูก · แต่พอเป็น
--    timestamptz แล้วใช้ `v_start::timestamptz` จะได้เที่ยงคืน **UTC** = 07:00 น. ไทย
--    → การใช้งาน 00:00–07:00 ของวันที่ 1 จะตกไปอยู่เดือนก่อนหน้า
--    **เปลี่ยน subquery revenue/subscriber_count ให้ใช้ค่าเดียวกันด้วย** — ของเดิม
--    เหลื่อม 7 ชม. อยู่แล้ว เป็นบั๊กเล็ก ๆ ที่ยังไม่เคยแสดงผลเพราะยังไม่มี subscription จริง
--    ตอนนี้คือจังหวะเดียวที่แก้ได้ฟรี และทำให้ทั้ง RPC ยึดเขตเวลาเดียวกันหมด
--
-- ⚠️ **`stream_days` ไม่ใช่แหล่งเงินอีกต่อไป แต่ยังถูกเขียนอยู่และห้ามลบ** —
-- หน้า `/admin/members` ใช้เทียบกับ `sub_download_logs` เป็นสัญญาณ
-- "โหลดมากแต่ใช้จริงน้อย" · ใครมาไล่แก้ตัวเลขเงินทีหลัง อย่าหลงไปแก้ที่ตารางนั้น

create or replace function public.subscription_month_data(p_year integer, p_month integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  -- ขอบเดือนตามเวลาไทย (ดูเหตุผลข้อ 3 ในหัวไฟล์) — ใช้ค่าเดียวกันทั้ง RPC
  v_start_ts timestamptz := (make_date(p_year, p_month, 1))::timestamp
                              at time zone 'Asia/Bangkok';
  v_end_ts   timestamptz := ((make_date(p_year, p_month, 1) + interval '1 month')::timestamp)
                              at time zone 'Asia/Bangkok';
  v_users int;
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
  create temp table _sd on commit drop as
    select s.user_id,
           s.font_id,
           sum(greatest(
             extract(epoch from (
                 least(coalesce(s.ended_at, s.last_seen_at), v_end_ts)
               - greatest(s.started_at, v_start_ts)
             )),
             0
           ))::numeric as secs
    from public.stream_sessions s
    join public.users u on u.id = s.user_id
    where u.role <> 'admin'
      and s.started_at < v_end_ts
      and coalesce(s.ended_at, s.last_seen_at) > v_start_ts
    group by s.user_id, s.font_id
    having sum(greatest(
             extract(epoch from (
                 least(coalesce(s.ended_at, s.last_seen_at), v_end_ts)
               - greatest(s.started_at, v_start_ts)
             )),
             0
           )) > 0;

  -- ตัวหารของ user-centric: เวลารวมทุกฟอนต์ของคนนั้น
  create temp table _ut on commit drop as
    select user_id, sum(secs) as total from _sd group by user_id;

  select count(*) into v_users from _ut;

  -- stream_share ต่อฟอนต์ = sum_over_users( secs(u,f)/total(u) ) / v_users
  -- **สูตรเดียวกับตอนเป็นวันทุกตัวอักษร** เปลี่ยนแค่หน่วยของตัวแปร
  create temp table _w on commit drop as
    select s.font_id,
           case when v_users > 0
                then sum( (s.secs / ut.total) ) / v_users
                else 0 end as stream_share,
           sum(s.secs) as font_seconds
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
    'opted_fonts', coalesce((
      select jsonb_agg(
        case when v_role = 'admin' or f.owner_id = v_uid then
          jsonb_build_object(
            'font_id', f.id,
            'name', coalesce(f.name, f.name_th),
            'owner_id', f.owner_id,
            'stream_share', coalesce(w.stream_share, 0),
            'font_seconds', coalesce(w.font_seconds, 0)
          )
        else
          -- คงจำนวนแถวไว้เท่าเดิม (client ใช้เป็นตัวหาร equalPerFont) แต่ปิดข้อมูล
          jsonb_build_object(
            'font_id', null,
            'name', null,
            'owner_id', null,
            'stream_share', 0,
            'font_seconds', 0
          )
        end
      )
      from public.fonts f
      left join _w w on w.font_id = f.id
      where f.is_subscription = true and f.is_active = true and f.owner_id is not null
    ), '[]'::jsonb),
    -- ฟอนต์ที่ opt-out ไปแล้วแต่ยังมีการใช้งานในเดือนนั้น (ยังจ่ายส่วน stream ให้เจ้าของ)
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
        and w.font_id not in (
          select id from public.fonts
          where is_subscription = true and is_active = true and owner_id is not null
        )
        and (v_role = 'admin' or f.owner_id = v_uid)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- เจตนาเดิมมี grant ให้แค่ authenticated (ไม่มี anon) ยืนยันซ้ำให้ชัดเจนหลัง replace
revoke execute on function public.subscription_month_data(integer, integer) from public, anon;
grant execute on function public.subscription_month_data(integer, integer) to authenticated;
