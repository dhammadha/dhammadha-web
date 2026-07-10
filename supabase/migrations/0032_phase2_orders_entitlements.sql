-- Phase 2 — Quote-to-cash แบบ manual
-- 1. ตารางใหม่: orders / entitlements / download_logs + doc_counters (เลขที่เอกสารกันชนกัน)
-- 2. RPC: confirm_quote_paid (designer ยืนยันรับชำระ → order + entitlements),
--         claim_my_entitlements (ผูก entitlement กับ user หลัง login),
--         verify_order (หน้า /verify สาธารณะ — ตรวจเลข order ที่ stamp ในไฟล์ฟอนต์)
-- 3. ปิดช่องโหว่: policy "auth read full" (0007) เปิดให้ทุก user ที่ login อ่าน bucket
--    fonts-full ตรง ๆ ได้ → จำกัดเหลือเจ้าของฟอนต์/แอดมิน (Edge Function ใช้ service role)

-- ── 1. เลขที่เอกสารฝั่ง server (แทน genDocNo ฝั่ง client ที่ชนกันได้) ──────────

create table public.doc_counters (
  prefix text not null,
  year int not null,
  last_no int not null default 0,
  primary key (prefix, year)
);

create function public.next_doc_no(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int + 543; -- พ.ศ. ให้ตรงกับ QT/RC เดิม
  v_no int;
begin
  insert into doc_counters (prefix, year, last_no)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
  do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;
  return p_prefix || '-' || v_year || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- เรียกได้จากใน RPC อื่นเท่านั้น — ห้าม client เรียกตรง (กันเลขไหลทิ้ง)
revoke execute on function public.next_doc_no(text) from public, anon, authenticated;

-- ── 2. orders ───────────────────────────────────────────────────────────────

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  quote_id uuid references public.quotes(id) on delete set null,
  designer_id uuid references public.users(id) on delete set null,
  customer_user_id uuid references public.users(id) on delete set null,
  customer_email text not null,
  customer_name text,
  company_name text,
  -- [{font_id, name, license_type, price}]
  items jsonb not null,
  total_amount numeric not null default 0,
  status text not null default 'paid' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- quote หนึ่งใบยืนยันรับชำระได้ครั้งเดียว (กันกดซ้ำ/ยิงซ้ำ)
create unique index orders_quote_id_unique on public.orders (quote_id) where quote_id is not null;
create index orders_designer_id_idx on public.orders (designer_id);
create index orders_customer_email_idx on public.orders (lower(customer_email));

alter table public.orders enable row level security;

create policy "designer read own orders"
  on public.orders for select
  using (designer_id = auth.uid());

create policy "customer read own orders"
  on public.orders for select
  using (
    customer_user_id = auth.uid()
    or lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "admin all orders"
  on public.orders for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- เขียนผ่าน RPC เท่านั้น — grant แค่ select
grant select on public.orders to authenticated;

-- ── 3. entitlements — หัวใจของระบบ: สิทธิ์ดาวน์โหลดที่เช็คก่อนออกไฟล์ ─────────

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  font_id uuid not null references public.fonts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  license_type text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, font_id)
);

create index entitlements_user_id_idx on public.entitlements (user_id);
create index entitlements_email_idx on public.entitlements (lower(email));

alter table public.entitlements enable row level security;

create policy "owner read own entitlements"
  on public.entitlements for select
  using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "designer read entitlements of own orders"
  on public.entitlements for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.designer_id = auth.uid()
  ));

create policy "admin all entitlements"
  on public.entitlements for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

grant select on public.entitlements to authenticated;

-- ── 4. download_logs — เขียนโดย Edge Function (service role) เท่านั้น ─────────

create table public.download_logs (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  user_id uuid,
  font_id uuid,
  file_path text,
  ip text,
  created_at timestamptz not null default now()
);

create index download_logs_entitlement_idx on public.download_logs (entitlement_id, created_at);

alter table public.download_logs enable row level security;

create policy "admin read download logs"
  on public.download_logs for select
  using (public.get_my_role() = 'admin');

create policy "designer read own fonts download logs"
  on public.download_logs for select
  using (exists (
    select 1 from public.fonts f
    where f.id = font_id and f.owner_id = auth.uid()
  ));

grant select on public.download_logs to authenticated;

-- ── 5. confirm_quote_paid — designer กด "ยืนยันรับชำระ" ─────────────────────
-- p_items: [{font_id, name, license_type, price}] — designer จับคู่ชื่อฟอนต์ใน
-- quote กับฟอนต์จริงบนแพลตฟอร์มก่อนยืนยัน

create function public.confirm_quote_paid(p_quote_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_role();
  v_quote quotes%rowtype;
  v_order orders%rowtype;
  v_item jsonb;
  v_font_id uuid;
  v_price numeric;
  v_total numeric := 0;
  v_customer_user_id uuid;
begin
  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'quote_not_found';
  end if;
  if v_role <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from orders where quote_id = p_quote_id) then
    raise exception 'already_confirmed';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  -- ตรวจทุก item: font_id ต้องมีจริง และ (ถ้าไม่ใช่ admin) ต้องเป็นฟอนต์ของ designer เจ้าของ quote
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_font_id := (v_item ->> 'font_id')::uuid;
    v_price := coalesce((v_item ->> 'price')::numeric, 0);
    if v_font_id is null then
      raise exception 'item_missing_font';
    end if;
    if v_price < 0 then
      raise exception 'invalid_price';
    end if;
    if not exists (
      select 1 from fonts f
      where f.id = v_font_id
        and (v_role = 'admin' or f.owner_id = v_quote.designer_id)
    ) then
      raise exception 'font_not_found_or_not_owned';
    end if;
    v_total := v_total + v_price;
  end loop;

  select id into v_customer_user_id
  from users where lower(email) = lower(v_quote.email) limit 1;

  insert into orders (
    order_no, quote_id, designer_id, customer_user_id,
    customer_email, customer_name, company_name,
    items, total_amount, status, paid_at
  ) values (
    public.next_doc_no('OR'), p_quote_id, v_quote.designer_id, v_customer_user_id,
    v_quote.email, v_quote.contact_name, v_quote.company_name,
    p_items, v_total, 'paid', now()
  )
  returning * into v_order;

  insert into entitlements (order_id, font_id, user_id, email, license_type)
  select v_order.id,
         (i ->> 'font_id')::uuid,
         v_customer_user_id,
         v_quote.email,
         coalesce(i ->> 'license_type', v_quote.license_type)
  from jsonb_array_elements(p_items) i
  on conflict (order_id, font_id) do nothing;

  return to_jsonb(v_order);
end;
$$;

revoke execute on function public.confirm_quote_paid(uuid, jsonb) from public, anon;
grant execute on function public.confirm_quote_paid(uuid, jsonb) to authenticated;

-- ── 6. claim_my_entitlements — ผูกสิทธิ์ที่ออกด้วยอีเมลเข้ากับบัญชีหลัง login ──

create function public.claim_my_entitlements()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count int;
begin
  if auth.uid() is null or v_email = '' then
    return 0;
  end if;
  update entitlements
  set user_id = auth.uid()
  where user_id is null and lower(email) = v_email;
  get diagnostics v_count = row_count;
  update orders
  set customer_user_id = auth.uid()
  where customer_user_id is null and lower(customer_email) = v_email;
  return v_count;
end;
$$;

revoke execute on function public.claim_my_entitlements() from public, anon;
grant execute on function public.claim_my_entitlements() to authenticated;

-- ── 7. verify_order — หน้า /verify สาธารณะ ตรวจเลข order ที่ stamp ในไฟล์ ─────

create function public.verify_order(p_order_no text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_order orders%rowtype;
  v_name text;
begin
  select * into v_order
  from orders
  where order_no = upper(trim(p_order_no)) and status = 'paid';
  if not found then
    return jsonb_build_object('valid', false);
  end if;
  -- ปกปิดชื่อลูกค้า: ตัวแรก + *** (เช่น "ส***")
  v_name := coalesce(nullif(v_order.customer_name, ''), v_order.customer_email);
  return jsonb_build_object(
    'valid', true,
    'order_no', v_order.order_no,
    'paid_at', v_order.paid_at,
    'licensed_to', left(v_name, 1) || '***',
    'fonts', (select jsonb_agg(i ->> 'name') from jsonb_array_elements(v_order.items) i)
  );
end;
$$;

grant execute on function public.verify_order(text) to anon, authenticated;

-- ── 8. ปิดช่องโหว่ fonts-full: จำกัดการอ่านเหลือเจ้าของฟอนต์/แอดมิน ──────────
-- path ใน bucket คือ "<font-slug>/<filename>" — เทียบ slug กับ owner_id

drop policy if exists "auth read full" on storage.objects;

create policy "owner or admin read full"
  on storage.objects for select
  using (
    bucket_id = 'fonts-full'
    and (
      public.get_my_role() = 'admin'
      or exists (
        select 1 from public.fonts f
        where f.slug = split_part(name, '/', 1) and f.owner_id = auth.uid()
      )
    )
  );
