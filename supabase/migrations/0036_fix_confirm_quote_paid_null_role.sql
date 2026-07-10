-- Fix: confirm_quote_paid หลุดการตรวจสิทธิ์เมื่อ get_my_role() คืน null
-- (JWT ใช้ได้แต่ sub ไม่มีแถวใน public.users เช่นแถว users ถูกลบ)
-- เพราะ `null <> 'admin'` เป็น null (falsy) → เงื่อนไข forbidden ไม่ทำงาน
-- แก้แบบเดียวกับ issue_quote_doc ใน 0035: coalesce(v_role, '') <> 'admin'
-- ตัวฟังก์ชันคัดลอกจาก 0032 ทั้งก้อน เปลี่ยนเฉพาะบรรทัดตรวจสิทธิ์
-- (ตรวจแล้วไม่มี migration 0033–0035 นิยาม confirm_quote_paid ทับ)

create or replace function public.confirm_quote_paid(p_quote_id uuid, p_items jsonb)
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
  if coalesce(v_role, '') <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
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
