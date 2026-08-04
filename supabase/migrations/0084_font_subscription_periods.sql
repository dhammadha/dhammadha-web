-- ประวัติ "ฟอนต์อยู่ในแผนสมาชิกช่วงไหนบ้าง" (4 ส.ค. 2569)
--
-- ทำไมต้องมี: `subscription_month_data` เดิมตัดสินว่าฟอนต์ไหน "เข้าร่วม" จาก**สถานะ
-- ณ ตอนเรียก RPC** ซึ่งพังสองทาง
--   1. เอาฟอนต์เข้าแผนวันที่ 30 ก็ได้ส่วนแบ่ง 12% เต็มเดือนเท่ากับคนที่อยู่มาทั้งเดือน
--   2. ตัวเลขของ**เดือนที่ผ่านไปแล้ว**ขยับทุกครั้งที่มีใคร toggle เพราะไม่มี snapshot
-- เจ้าของเลือก (4 ส.ค. 2569) ให้ 12% เฉลี่ยตามจำนวนวันที่อยู่ในแผนจริง → ต้องมี
-- ประวัติก่อน ตารางนี้คือประวัตินั้น (0085 เป็นตัวเอาไปคิด)
--
-- นิยาม "อยู่ในแผน" = is_subscription and is_active — ชุดเดียวกับที่ Edge Function
-- `sub-font` ใช้ตัดสินว่าสมาชิกเห็น/โหลดฟอนต์ได้ไหม **เกณฑ์สิทธิ์กับเกณฑ์เงินต้อง
-- เป็นอันเดียวกัน** ไม่งั้นจะมีเดือนที่ฟอนต์ถูกซ่อนจากสมาชิกแต่ยังกินส่วนแบ่ง 12% อยู่

create table public.font_subscription_periods (
  id bigint generated always as identity primary key,
  font_id uuid not null references public.fonts(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index font_subscription_periods_font_idx
  on public.font_subscription_periods (font_id, started_at);

-- หาแถวที่ยังเปิดอยู่ตอน trigger ปิด period
create index font_subscription_periods_open_idx
  on public.font_subscription_periods (font_id)
  where ended_at is null;

-- ตารางนี้เป็นข้อมูลตั้งต้นของเงิน — เขียนได้จาก trigger เท่านั้น ไม่มี policy
-- insert/update/delete ให้ client เลย (จุดยืนเดียวกับ stream_sessions ใน 0081)
alter table public.font_subscription_periods enable row level security;

create policy "staff read font subscription periods"
  on public.font_subscription_periods for select
  using (public.get_my_role() in ('admin', 'designer'));

grant select on public.font_subscription_periods to authenticated;
grant all on public.font_subscription_periods to service_role;

-- ── trigger ────────────────────────────────────────────────────────────────
-- security definer เพราะ RLS ปิดทางเขียนไว้หมด · trigger จึงต้องรันในสิทธิ์ owner
create or replace function public.sync_font_subscription_period()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_was boolean := false;
  v_is  boolean := coalesce(new.is_subscription, false) and coalesce(new.is_active, false);
begin
  if tg_op = 'UPDATE' then
    v_was := coalesce(old.is_subscription, false) and coalesce(old.is_active, false);
  end if;

  -- ไม่มีการข้ามเส้น = ไม่ต้องทำอะไร (update ฟิลด์อื่นจะไม่สร้างแถวขยะ)
  if v_is = v_was then
    return new;
  end if;

  if v_is then
    insert into public.font_subscription_periods (font_id, started_at)
    values (new.id, now());
  else
    update public.font_subscription_periods
       set ended_at = now()
     where font_id = new.id
       and ended_at is null;
  end if;

  return new;
end;
$function$;

revoke execute on function public.sync_font_subscription_period() from public, anon;

create trigger fonts_sync_subscription_period
  after insert or update of is_subscription, is_active on public.fonts
  for each row execute function public.sync_font_subscription_period();

-- ── backfill ───────────────────────────────────────────────────────────────
-- ฟอนต์ที่อยู่ในแผนอยู่แล้ว ณ วันที่รัน migration: เปิด period ย้อนไปถึงวันเผยแพร่
-- (ถ้ายังไม่เคยเผยแพร่ใช้ created_at) — ไม่ใช่ now() ไม่งั้นเดือนนี้ทุกฟอนต์จะกลาย
-- เป็น "เพิ่งเข้าแผนวันนี้" แล้วส่วนแบ่ง 12% ของเดือนที่กำลังเดินอยู่จะเพี้ยนทั้งกระดาน
insert into public.font_subscription_periods (font_id, started_at)
select f.id, coalesce(f.published_at, f.created_at, now())
from public.fonts f
where f.is_subscription = true and f.is_active = true;

-- ย้อนกลับ:
--   drop trigger fonts_sync_subscription_period on public.fonts;
--   drop function public.sync_font_subscription_period();
--   drop table public.font_subscription_periods;
