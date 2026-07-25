-- 0069: ตะกร้าหลายฟอนต์ — แยกรายการในคำสั่งซื้อออกเป็นตาราง order_items
--
-- ที่มา: เดิม 1 order = 1 ฟอนต์ = 1 designer (orders.designer_id + platform_amount/
-- designer_amount ระดับ order) พอมีตะกร้าที่ซื้อข้ามนักออกแบบได้ในการจ่ายครั้งเดียว
-- โครงนี้เก็บส่วนแบ่งไม่ได้ → ย้ายยอดต่อรายการมาไว้ที่ order_items
--
-- ขอบเขตที่ตั้งใจ:
--  * order_items ใช้กับ **Retail (source='checkout')** เท่านั้น
--    คำสั่งซื้อจากใบเสนอราคา (source='quote') เป็นของ designer คนเดียวโดยธรรมชาติ
--    (quote ผูก designer_id เดียว) + มีส่วนลดระดับใบ ทำให้ผลรวมรายการ ≠ ยอดสุทธิ
--    จึงคงใช้ orders.items + orders.designer_id ตามเดิม ไม่ backfill เข้ามาที่นี่
--  * orders.items (jsonb) ยังเขียนอยู่เหมือนเดิมในฐานะ **สำเนาไว้แสดงผล**
--    (อีเมล, /admin/orders, /admin/payouts, checkout_order_status ใช้ตัวนี้)
--    แต่ "ความจริงเรื่องเงิน" ของ Retail ย้ายมาที่ order_items แล้ว
--  * orders.designer_id ยังใส่ให้เมื่อทั้งใบเป็นของนักออกแบบคนเดียว (โค้ดเก่าที่อ่าน
--    คอลัมน์นี้จึงยังทำงานได้) และเป็น null เมื่อในใบมีหลายนักออกแบบ

-- ── 1. ตาราง ────────────────────────────────────────────────────────────────

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  font_id uuid not null references public.fonts(id) on delete restrict,
  designer_id uuid references public.users(id) on delete set null,
  -- สำเนาชื่อฟอนต์ ณ เวลาขาย (ฟอนต์อาจถูกเปลี่ยนชื่อภายหลัง)
  name text,
  license_type text not null default 'personal',
  price numeric not null check (price >= 0),
  platform_rate numeric not null default 0.25,
  platform_amount numeric not null default 0,
  designer_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id, font_id)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_designer_id_idx on public.order_items (designer_id);
create index order_items_font_id_idx on public.order_items (font_id);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

alter table public.order_items enable row level security;

create policy "customer read items of own orders"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.customer_user_id = auth.uid()
        or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ));

-- นักออกแบบเห็น **เฉพาะรายการของตัวเอง** ในใบที่ซื้อข้ามร้าน
create policy "designer read own items"
  on public.order_items for select
  using (designer_id = auth.uid());

create policy "admin all order items"
  on public.order_items for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- เขียนผ่าน RPC (security definer) เท่านั้น เหมือน orders
grant select on public.order_items to authenticated;

-- ใบที่มีหลายนักออกแบบจะมี orders.designer_id = null ทำให้ policy เดิม
-- ("designer read own orders") มองไม่เห็น → เพิ่ม policy อ่านผ่าน order_items
-- หมายเหตุที่ยอมรับไว้: นักออกแบบจะเห็น orders.total_amount ของทั้งใบ (รวมของ
-- นักออกแบบคนอื่น) แต่ไม่เห็นว่าเป็นฟอนต์อะไรหรือของใคร — ยอดที่ใช้คำนวณเงิน
-- ทุกจุดอ่านจาก order_items ของตัวเองเท่านั้น
create policy "designer read orders with own items"
  on public.orders for select
  using (exists (
    select 1 from public.order_items oi
    where oi.order_id = orders.id and oi.designer_id = auth.uid()
  ));

-- ── 3. Backfill — Retail orders เดิม (1 ใบ 1 ฟอนต์) ─────────────────────────
-- ราคา/ส่วนแบ่งของเดิมอยู่ระดับ order อยู่แล้ว และทุกใบมีรายการเดียว
-- จึงคัดลอกตรง ๆ ได้โดยไม่ต้องเฉลี่ยเศษ

insert into public.order_items (
  order_id, font_id, designer_id, name, license_type,
  price, platform_rate, platform_amount, designer_amount, created_at
)
select
  o.id,
  (i ->> 'font_id')::uuid,
  o.designer_id,
  i ->> 'name',
  coalesce(i ->> 'license_type', 'personal'),
  coalesce((i ->> 'price')::numeric, o.total_amount),
  coalesce(o.platform_rate, 0.25),
  coalesce(o.platform_amount, round(coalesce((i ->> 'price')::numeric, o.total_amount) * 0.25, 2)),
  coalesce(o.designer_amount, coalesce((i ->> 'price')::numeric, o.total_amount)
    - coalesce(o.platform_amount, round(coalesce((i ->> 'price')::numeric, o.total_amount) * 0.25, 2))),
  o.created_at
from public.orders o
cross join lateral jsonb_array_elements(o.items) i
where o.source = 'checkout'
  and i ->> 'font_id' is not null
  and exists (select 1 from public.fonts f where f.id = (i ->> 'font_id')::uuid)
on conflict (order_id, font_id) do nothing;

-- ── 4. RPC สร้างคำสั่งซื้อหลายรายการ (เรียกโดย stripe webhook / service_role) ──
--
-- p_items: [{font_id, license_type, price}] — ราคาต่อรายการมาจาก line_items ของ
-- Stripe (ยอดที่เก็บเงินได้จริง) ไม่ใช่ราคาที่ client ส่งมา
-- idempotent: ยิงซ้ำด้วย session เดิม → คืน order เดิม ไม่สร้างใหม่

create function public.create_checkout_order_multi(
  p_session_id text,
  p_payment_intent text,
  p_items jsonb,
  p_email text,
  p_customer_name text,
  p_amount numeric,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item jsonb;
  v_font fonts%rowtype;
  v_price numeric;
  v_platform_rate numeric := 0.25;
  v_platform numeric;
  v_designer numeric;
  v_customer_user_id uuid;
  v_display jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_sum_platform numeric := 0;
  v_sum_designer numeric := 0;
  v_designers uuid[] := '{}';
  v_single_designer uuid;
begin
  if p_session_id is null or trim(p_session_id) = '' then
    raise exception 'missing_session';
  end if;
  if p_email is null or trim(p_email) = '' then
    raise exception 'missing_email';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid_amount';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  select * into v_order from orders where provider_session_id = p_session_id;
  if found then
    return to_jsonb(v_order);
  end if;

  if p_user_id is not null and exists (select 1 from users where id = p_user_id) then
    v_customer_user_id := p_user_id;
  else
    select id into v_customer_user_id
    from users where lower(email) = lower(p_email) limit 1;
  end if;

  -- รอบแรก: ตรวจฟอนต์ + คิดส่วนแบ่งรายรายการ (ยังไม่เขียน)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_font from fonts where id = (v_item ->> 'font_id')::uuid;
    if not found then
      raise exception 'font_not_found';
    end if;
    v_price := coalesce((v_item ->> 'price')::numeric, 0);
    if v_price < 0 then
      raise exception 'invalid_price';
    end if;
    v_platform := round(v_price * v_platform_rate, 2);
    v_designer := v_price - v_platform;
    v_sum_platform := v_sum_platform + v_platform;
    v_sum_designer := v_sum_designer + v_designer;
    if v_font.owner_id is not null and not (v_font.owner_id = any(v_designers)) then
      v_designers := array_append(v_designers, v_font.owner_id);
    end if;

    v_display := v_display || jsonb_build_object(
      'font_id', v_font.id,
      'name', coalesce(v_font.name, v_font.name_th, v_font.slug),
      'license_type', coalesce(v_item ->> 'license_type', 'personal'),
      'price', v_price
    );
    v_rows := v_rows || jsonb_build_object(
      'font_id', v_font.id,
      'designer_id', v_font.owner_id,
      'name', coalesce(v_font.name, v_font.name_th, v_font.slug),
      'license_type', coalesce(v_item ->> 'license_type', 'personal'),
      'price', v_price,
      'platform_amount', v_platform,
      'designer_amount', v_designer
    );
  end loop;

  -- ทั้งใบเป็นของนักออกแบบคนเดียว → ใส่ designer_id ไว้ให้โค้ดเดิมอ่านได้
  v_single_designer := case when array_length(v_designers, 1) = 1 then v_designers[1] else null end;

  insert into orders (
    order_no, designer_id, customer_user_id,
    customer_email, customer_name,
    items, total_amount, status, paid_at,
    source, payment_provider, provider_session_id, provider_payment_intent,
    platform_rate, platform_amount, designer_amount
  ) values (
    public.next_doc_no('OR'), v_single_designer, v_customer_user_id,
    lower(trim(p_email)), nullif(trim(coalesce(p_customer_name, '')), ''),
    v_display, p_amount, 'paid', now(),
    'checkout', 'stripe', p_session_id, p_payment_intent,
    v_platform_rate, round(v_sum_platform, 2), round(v_sum_designer, 2)
  )
  returning * into v_order;

  insert into order_items (
    order_id, font_id, designer_id, name, license_type,
    price, platform_rate, platform_amount, designer_amount
  )
  select
    v_order.id,
    (r ->> 'font_id')::uuid,
    nullif(r ->> 'designer_id', '')::uuid,
    r ->> 'name',
    r ->> 'license_type',
    (r ->> 'price')::numeric,
    v_platform_rate,
    (r ->> 'platform_amount')::numeric,
    (r ->> 'designer_amount')::numeric
  from jsonb_array_elements(v_rows) r
  on conflict (order_id, font_id) do nothing;

  insert into entitlements (order_id, font_id, user_id, email, license_type)
  select v_order.id,
         (r ->> 'font_id')::uuid,
         v_customer_user_id,
         lower(trim(p_email)),
         r ->> 'license_type'
  from jsonb_array_elements(v_rows) r
  on conflict (order_id, font_id) do nothing;

  return to_jsonb(v_order);
exception
  -- แข่งกันเขียน session เดียวกัน → คืนใบเดิม (เหมือน create_checkout_order เดิม)
  when unique_violation then
    select * into v_order from orders where provider_session_id = p_session_id;
    if found then
      return to_jsonb(v_order);
    end if;
    raise;
end;
$$;

revoke execute on function
  public.create_checkout_order_multi(text, text, jsonb, text, text, numeric, uuid)
  from public, anon, authenticated;
grant execute on function
  public.create_checkout_order_multi(text, text, jsonb, text, text, numeric, uuid)
  to service_role;
