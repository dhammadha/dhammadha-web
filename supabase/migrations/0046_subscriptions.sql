-- Phase 4.1 — Subscriptions: สมาชิกรายเดือน/รายปี (ช่วงแรก = trial ฿0 ไม่ผูก gateway)
--
-- ออกแบบเป็นกลางต่อ payment provider: 'trial' (ช่วงทดสอบ ฿0), 'stripe'/'payso'
-- (gateway จริงภายหลัง), 'admin' (comp ให้โดย admin เช่น บัญชีทดสอบ)
-- "active" ไม่มี cron คอย flip status — ทุกจุด (RPC/Edge Function/UI) คำนวณเสมอเป็น
--   status = 'active' AND current_period_end > now()
-- ส่วน status 'expired'/'cancelled' มีไว้ให้ admin จัดการบัญชีย้อนหลัง

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('trial', 'stripe', 'payso', 'admin')),
  provider_subscription_id text,          -- id ฝั่ง gateway (null สำหรับ trial/admin)
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  price_amount numeric not null default 0 check (price_amount >= 0), -- ฿/รอบบิล ณ ตอนสมัคร (trial = 0)
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null, -- สิทธิ์ใช้ได้ถึงเมื่อไหร่ (trial = trial_end_date)
  cancelled_at timestamptz,
  note text,                               -- โน้ตของ admin (เช่น เหตุผล comp)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- active ได้ 1 แถวต่อคน (กันสมัครซ้ำ + ทำให้ RPC race-safe)
create unique index subscriptions_one_active_per_user
  on public.subscriptions (user_id) where status = 'active';

create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);

alter table public.subscriptions enable row level security;

create policy "own subscription read"
  on public.subscriptions for select
  using (user_id = auth.uid());

create policy "admin all subscriptions"
  on public.subscriptions for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- user ทั่วไป insert ตรงไม่ได้ (ไม่มี policy) — สมัคร trial ผ่าน RPC ด้านล่างเท่านั้น
-- admin เขียนตรงได้ผ่าน policy ข้างบน (ยืดอายุ/ยกเลิก/comp)
grant select, insert, update, delete on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- ── RPC สมัคร trial ฿0 ──
-- อ่านเงื่อนไขจาก settings key 'subscription':
--   { "monthly_price": 290, "yearly_price": 2900,
--     "trial_active": true, "trial_end_date": "2026-09-30", ... }
-- idempotent: มี active อยู่แล้ว → คืนแถวเดิม (กันดับเบิลคลิก / กด refresh)
create or replace function public.start_trial_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_existing public.subscriptions;
  v_end timestamptz;
  v_row public.subscriptions;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select value into v_settings from public.settings where key = 'subscription';
  if v_settings is null
     or coalesce((v_settings->>'trial_active')::boolean, false) is not true then
    raise exception 'trial_closed';
  end if;

  -- trial_end_date เป็นวันสุดท้ายที่ใช้ได้ (inclusive) → สิทธิ์หมดต้นวันถัดไป
  v_end := ((v_settings->>'trial_end_date')::date + 1)::timestamptz;
  if v_end is null or v_end <= now() then
    raise exception 'trial_closed';
  end if;

  select * into v_existing
    from public.subscriptions
    where user_id = auth.uid() and status = 'active'
    limit 1;
  if found then
    return to_jsonb(v_existing);
  end if;

  insert into public.subscriptions (user_id, provider, status, price_amount, current_period_end)
    values (auth.uid(), 'trial', 'active', 0, v_end)
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.start_trial_subscription() from public, anon;
grant execute on function public.start_trial_subscription() to authenticated;
