-- 🔴 subscription_month_data(p_year, p_month) เช็คแค่ get_my_role() in ('admin','designer')
-- แล้วคืนข้อมูลระดับแพลตฟอร์มทั้งหมดเหมือนกันทุก role: opted_fonts/orphan_stream มี
-- owner_id + stream_share + font_days ของ "ทุกฟอนต์ในระบบ" ไม่ใช่แค่ของผู้เรียก
-- → designer คนหนึ่งเห็นส่วนแบ่งของ designer คนอื่นได้หมด (คู่แข่งเห็นกันเอง)
--
-- แก้: คำนวณเหมือนเดิมทุกอย่าง (ตัวเลขรวม/สูตรแบ่งเงินไม่เปลี่ยน) แต่ก่อนคืนผลให้ non-admin:
--   - opted_fonts: เก็บ "จำนวนแถว" ไว้เท่าเดิม (จำเป็นต่อสูตร equalPerFont = revenue*0.12/
--     opted_fonts.length ฝั่ง client — ลด length ผิดจะทำให้ยอดของ designer เองผิดไปด้วย)
--     แต่ redact ฟอนต์ที่ไม่ใช่ของตัวเอง: font_id/name/owner_id เป็น null, stream_share/
--     font_days เป็น 0 — เห็นเฉพาะแถวของตัวเองที่ยังมีข้อมูลจริง
--   - orphan_stream: ไม่มีสูตรไหนพึ่ง length ของ array นี้ เลย filter เอาแถวอื่นออกไปเลย
--   - subscriber_count / contributing_users: เป็นตัวเลขรวมระดับแพลตฟอร์ม ไม่ถูกใช้คำนวณ
--     ส่วนแบ่งต่อฟอนต์เลย (ใช้แสดงผลฝั่ง Admin เท่านั้น ดู SubscriptionRevenue.tsx AdminView) →
--     redact เป็น 0 สำหรับ designer ได้โดยไม่กระทบเลขที่ designer เห็น
--   - revenue: **ไม่ redact** แม้ brief จะขอ "omit or redact platform-wide totals" เพราะ
--     เป็นตัวหารร่วม/ตัวคูณตรงในสูตร equalPerFont และ streamAmount ฝั่ง client
--     (src/lib/subscription-revenue.ts) — ถ้าซ่อนตัวเลขนี้ ยอดเงินที่ designer เห็นของ
--     "ตัวเอง" จะผิด ขัดกับโจทย์ "don't change the revenue math" ที่ชัดเจนกว่า
--     ยอดรวม revenue ระดับแพลตฟอร์มเองก็ไม่ได้ระบุตัวตนคู่แข่งรายใดรายหนึ่ง ความเสี่ยงต่างจาก
--     per-font owner_id/stream_share ที่ระบุตัวได้ชัดเจน

create or replace function public.subscription_month_data(p_year integer, p_month integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_start date := make_date(p_year, p_month, 1);
  v_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
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

  create temp table _sd on commit drop as
    select d.user_id, d.font_id, count(*)::numeric as days
    from public.stream_days d
    join public.users u on u.id = d.user_id
    where u.role <> 'admin'
      and d.day >= v_start and d.day < v_end
    group by d.user_id, d.font_id;

  create temp table _ut on commit drop as
    select user_id, sum(days) as total from _sd group by user_id;

  select count(*) into v_users from _ut;

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
    'subscriber_count', case when v_role <> 'admin' then 0 else coalesce((
      select count(*)
      from public.subscriptions s
      join public.users u on u.id = s.user_id
      where u.role <> 'admin'
        and s.started_at < v_end::timestamptz
        and s.current_period_end > v_start::timestamptz
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
            'font_days', coalesce(w.font_days, 0)
          )
        else
          jsonb_build_object(
            'font_id', null,
            'name', null,
            'owner_id', null,
            'stream_share', 0,
            'font_days', 0
          )
        end
      )
      from public.fonts f
      left join _w w on w.font_id = f.id
      where f.is_subscription = true and f.is_active = true and f.owner_id is not null
    ), '[]'::jsonb),
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
        and (v_role = 'admin' or f.owner_id = v_uid)
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- เจตนาเดิมมี grant ให้แค่ authenticated (ไม่มี anon) ยืนยันซ้ำให้ชัดเจนหลัง replace
revoke execute on function public.subscription_month_data(integer, integer) from public;
grant execute on function public.subscription_month_data(integer, integer) to authenticated;
