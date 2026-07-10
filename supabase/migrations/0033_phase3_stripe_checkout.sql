-- Phase 3 — B2C self-serve checkout ผ่าน Stripe
-- 1. orders: เพิ่มคอลัมน์ที่มาของ order (quote/checkout), อ้างอิง Stripe session,
--    และบันทึกส่วนแบ่ง 75/25 ณ เวลาขาย (เฉพาะ order จาก checkout — เงิน quote
--    เข้าบัญชี designer ตรง เว็บไม่หักส่วนแบ่ง)
-- 2. RPC create_checkout_order — เรียกโดย Stripe webhook (service_role เท่านั้น)
--    idempotent ด้วย provider_session_id กัน webhook ยิงซ้ำ
-- 3. RPC checkout_order_status — หน้า /checkout/success ใช้ poll สถานะด้วย
--    session id (token ลับจาก Stripe ที่เดาไม่ได้) — เปิดเผยข้อมูลแบบ mask

-- ── 1. orders columns ────────────────────────────────────────────────────────

alter table public.orders
  add column source text not null default 'quote'
    check (source in ('quote', 'checkout')),
  add column payment_provider text,
  add column provider_session_id text,
  add column provider_payment_intent text,
  add column platform_rate numeric,
  add column platform_amount numeric,
  add column designer_amount numeric;

-- webhook ยิงซ้ำได้ (Stripe retry) — session หนึ่งต้องเป็น order เดียวเสมอ
create unique index orders_provider_session_unique
  on public.orders (provider_session_id)
  where provider_session_id is not null;

-- ── 2. create_checkout_order — service_role เท่านั้น ─────────────────────────
-- ราคา (p_amount, THB) มาจาก Stripe amount_total ของ session ที่เราสร้างเอง
-- ด้วยราคาที่คำนวณฝั่ง server แล้ว — ไม่รับจาก client

create function public.create_checkout_order(
  p_session_id text,
  p_payment_intent text,
  p_font_id uuid,
  p_license_type text,
  p_email text,
  p_customer_name text,
  p_amount numeric,
  p_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_font fonts%rowtype;
  v_order orders%rowtype;
  v_customer_user_id uuid;
  v_platform_rate numeric := 0.25;
  v_platform_amount numeric;
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

  -- idempotent: webhook ยิงซ้ำ → คืน order เดิม ไม่สร้างใหม่
  select * into v_order from orders where provider_session_id = p_session_id;
  if found then
    return to_jsonb(v_order);
  end if;

  select * into v_font from fonts where id = p_font_id;
  if not found then
    raise exception 'font_not_found';
  end if;

  -- ผูกกับบัญชี user: จาก metadata (ลูกค้า login ตอนซื้อ) หรือเทียบอีเมล
  if p_user_id is not null and exists (select 1 from users where id = p_user_id) then
    v_customer_user_id := p_user_id;
  else
    select id into v_customer_user_id
    from users where lower(email) = lower(p_email) limit 1;
  end if;

  v_platform_amount := round(p_amount * v_platform_rate, 2);

  insert into orders (
    order_no, designer_id, customer_user_id,
    customer_email, customer_name,
    items, total_amount, status, paid_at,
    source, payment_provider, provider_session_id, provider_payment_intent,
    platform_rate, platform_amount, designer_amount
  ) values (
    public.next_doc_no('OR'), v_font.owner_id, v_customer_user_id,
    lower(trim(p_email)), nullif(trim(coalesce(p_customer_name, '')), ''),
    jsonb_build_array(jsonb_build_object(
      'font_id', v_font.id,
      'name', coalesce(v_font.name, v_font.name_th, v_font.slug),
      'license_type', coalesce(p_license_type, 'personal'),
      'price', p_amount
    )),
    p_amount, 'paid', now(),
    'checkout', 'stripe', p_session_id, p_payment_intent,
    v_platform_rate, v_platform_amount, p_amount - v_platform_amount
  )
  returning * into v_order;

  insert into entitlements (order_id, font_id, user_id, email, license_type)
  values (
    v_order.id, v_font.id, v_customer_user_id,
    lower(trim(p_email)), coalesce(p_license_type, 'personal')
  )
  on conflict (order_id, font_id) do nothing;

  return to_jsonb(v_order);
exception
  -- กันแข่งกันเขียน session เดียวกันพร้อมกัน (unique index ชน) → คืน order เดิม
  when unique_violation then
    select * into v_order from orders where provider_session_id = p_session_id;
    if found then
      return to_jsonb(v_order);
    end if;
    raise;
end;
$$;

revoke execute on function
  public.create_checkout_order(text, text, uuid, text, text, text, numeric, uuid)
  from public, anon, authenticated;
grant execute on function
  public.create_checkout_order(text, text, uuid, text, text, text, numeric, uuid)
  to service_role;

-- ── 3. checkout_order_status — หน้า /checkout/success poll ระหว่างรอ webhook ──

create function public.checkout_order_status(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order
  from orders
  where provider_session_id = trim(p_session_id) and status = 'paid';
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'order_no', v_order.order_no,
    'paid_at', v_order.paid_at,
    'customer_email', v_order.customer_email,
    'fonts', (select jsonb_agg(i ->> 'name') from jsonb_array_elements(v_order.items) i)
  );
end;
$$;

grant execute on function public.checkout_order_status(text) to anon, authenticated;
