-- 0044: confirm_quote_paid ใช้ราคาที่บันทึกบน quote เป็นหลัก (กัน client แก้ยอด)
--
-- ปรับปรุงจาก 0043:
--  - ถ้า quote มี fonts_detail (ออกใบเสนอราคาแบบมีราคาแล้ว) → ใช้รายการ/ราคาจาก
--    fonts_detail เป็นแหล่งความจริง ไม่สนราคาที่ client ส่งมา → ยอดตรงกับใบเสนอราคาเสมอ
--  - legacy (ไม่มี fonts_detail เช่น quote เก่า/กรอกราคาเองใน modal) → ใช้ p_items ที่ส่งมา
--    แล้ว "บันทึกกลับลง fonts_detail" เพื่อให้ใบเสร็จ/เอกสารที่สร้างหลังจากนี้ดึงราคา
--    ที่ยืนยันจริงไปแสดง (ไม่ไปดึงราคา list ที่อาจไม่ตรง)
--  - ส่วนลด/ยอดสุทธิ + ออกเลขใบเสร็จ RC อัตโนมัติ เหมือน 0043

create or replace function public.confirm_quote_paid(p_quote_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.get_my_role()::text;
  v_quote quotes%rowtype;
  v_order orders%rowtype;
  v_items jsonb;
  v_item jsonb;
  v_font_id uuid;
  v_price numeric;
  v_sum numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_customer_user_id uuid;
  v_receipt_no text;
  v_had_detail boolean;
begin
  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'quote_not_found';
  end if;
  if coalesce(v_role, '') <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;
  if exists (select 1 from orders where quote_id = p_quote_id) then
    raise exception 'already_confirmed';
  end if;

  -- แหล่งรายการ: ใช้ fonts_detail ที่บันทึกไว้ก่อน (กันแก้ฝั่ง client); ไม่มีค่อย fallback p_items
  v_had_detail := v_quote.fonts_detail is not null
    and jsonb_typeof(v_quote.fonts_detail) = 'array'
    and jsonb_array_length(v_quote.fonts_detail) > 0;
  v_items := case when v_had_detail then v_quote.fonts_detail else p_items end;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'invalid_items';
  end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
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
    v_sum := v_sum + v_price;
  end loop;

  v_discount := greatest(coalesce(v_quote.discount, 0), 0);
  v_total := greatest(v_sum - v_discount, 0);

  select id into v_customer_user_id
  from users where lower(email) = lower(v_quote.email) limit 1;

  insert into orders (
    order_no, quote_id, designer_id, customer_user_id,
    customer_email, customer_name, company_name,
    items, total_amount, discount, status, paid_at
  ) values (
    public.next_doc_no('OR'), p_quote_id, v_quote.designer_id, v_customer_user_id,
    v_quote.email, v_quote.contact_name, v_quote.company_name,
    v_items, v_total, v_discount, 'paid', now()
  )
  returning * into v_order;

  insert into entitlements (order_id, font_id, user_id, email, license_type)
  select v_order.id,
         (i ->> 'font_id')::uuid,
         v_customer_user_id,
         v_quote.email,
         coalesce(i ->> 'license_type', v_quote.license_type)
  from jsonb_array_elements(v_items) i
  on conflict (order_id, font_id) do nothing;

  -- legacy: บันทึกรายการที่ยืนยันจริงลง quote เพื่อให้เอกสารใบเสร็จดึงราคาไปแสดงตรงกัน
  if not v_had_detail then
    update quotes set fonts_detail = v_items, total_amount = v_total where id = p_quote_id;
  end if;

  -- ออกใบเสร็จ RC อัตโนมัติ (ถ้ายังไม่มี)
  v_receipt_no := v_quote.receipt_no;
  if v_receipt_no is null then
    v_receipt_no := public.next_doc_no('RC');
    update quotes
    set receipt_no = v_receipt_no, receipt_issued_at = now(), issued_by = auth.uid()
    where id = p_quote_id;
  end if;

  return to_jsonb(v_order) || jsonb_build_object('receipt_no', v_receipt_no);
end;
$$;

revoke execute on function public.confirm_quote_paid(uuid, jsonb) from public, anon;
grant execute on function public.confirm_quote_paid(uuid, jsonb) to authenticated;
