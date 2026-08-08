-- 0086 — เก็บ "ราคาเต็ม" ต่อรายการลง orders.items
--
-- ปัญหา: ใบเสร็จของการขายรายชุดพิมพ์แค่ยอดสุทธิ (RC-2569-0021: KRONN 560.00 →
-- รวม 560.00 → ยอดชำระ 560.00) ลูกค้าไม่เห็นว่าราคาเต็ม 800 แล้วได้ส่วนลด 240
--
-- ต้นตออยู่ที่ข้อมูล ไม่ใช่ตัวเรนเดอร์ — `quote-doc.ts` มีบรรทัด "ส่วนลด" อยู่แล้ว
-- (ใบเสนอราคาพิมพ์ครบเพราะ quotes.discount มีค่าจริง) แต่ฝั่ง retail ราคาเต็มหาย
-- ตั้งแต่ก่อนถึง Stripe: `computePersonalPrice` ยุบเหลือ salePrice ก่อนสร้าง session
-- แล้ว webhook อ่านกลับมาจาก line_items.amount_total ซึ่งเป็นยอดที่เก็บได้จริง
--
-- แก้: RPC มี v_font อยู่ในมือแล้วตอน insert → เขียน v_font.price ลง items ไปด้วย
--
-- ⚠️ ทำไมต้องอ่านตอน insert ไม่ใช่ join fonts ตอนพิมพ์ใบ:
-- ราคาบนเอกสารต้อง**ตรึง ณ วันที่ซื้อ** (กติกาเดียวกับ license wording ใน
-- quotes.fonts_detail) ถ้าไปอ่าน fonts.price ตอนเปิดใบเสร็จ ดีไซน์เนอร์ขึ้นราคา
-- วันหลังแล้วใบเก่าที่ส่งไปแล้วจะเปลี่ยนตัวเลขตาม
--
-- ไม่มี schema change — orders.items เป็น jsonb อยู่แล้ว
-- ออเดอร์เก่าที่ไม่มี list_price: ฝั่ง TS ถอยไปใช้ price ตามเดิม (ใบเก่าพิมพ์ซ้ำได้หน้าตาเดิม)
--
-- เนื้อฟังก์ชันคัดลอกจาก 0069 ทั้งดุ้น ต่างแค่ 'list_price' ใน v_display

create or replace function public.create_checkout_order_multi(
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
      -- ราคาเต็ม ณ วันที่ซื้อ — ใบเสร็จเอาไปพิมพ์เป็น "รวมจำนวนเงิน" แล้วหักเป็น "ส่วนลด"
      -- ใช้ fonts.price ตรง ๆ ได้เพราะ retail ขายเฉพาะสิทธิ์บุคคลธรรมดา
      -- (checkout-service ตั้ง metadata[license_type] = 'personal' ตายตัว) ไม่แตะ tier องค์กร
      'list_price', v_font.price,
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

-- create or replace ไม่ล้าง grant เดิม แต่ประกาศซ้ำไว้ให้ไฟล์นี้อ่านจบเองได้
-- (Postgres แจก execute ให้ PUBLIC อัตโนมัติ — ต้อง revoke เสมอ ดู 0041)
revoke execute on function
  public.create_checkout_order_multi(text, text, jsonb, text, text, numeric, uuid)
  from public, anon, authenticated;
grant execute on function
  public.create_checkout_order_multi(text, text, jsonb, text, text, numeric, uuid)
  to service_role;
