-- 0043: เก็บราคา/ส่วนลดบนใบเสนอราคา + ยืนยันชำระออกใบเสร็จอัตโนมัติ
--
-- เดิม: ราคาไม่เคยถูกเก็บบน quote (fonts_detail/total_amount = null ตั้งแต่ฟอร์มลูกค้า)
-- ทำให้ตอนยืนยันรับชำระต้องกรอกยอดมือ (เสี่ยงพลาด) และใบเสร็จเป็นปุ่มแยก
--
-- ใหม่:
--  A) เพิ่มคอลัมน์ discount (ส่วนลดบาท) บน quotes และ orders
--  B) RPC issue_quotation_priced — ตอนออกใบเสนอราคา เจ้าของฟอนต์ตรวจ/แก้ราคา +
--     ใส่ส่วนลด แล้วบันทึกลง quote (fonts_detail/discount/total_amount) + ออกเลข QT
--  C) confirm_quote_paid — อ่าน discount จาก quote (กัน client แก้) คิดยอดสุทธิ
--     เก็บบน order และ "ออกเลขใบเสร็จ RC อะตอมมิกในตัว" คืน receipt_no กลับด้วย

-- ── A. คอลัมน์ discount ──────────────────────────────────────────────────────
alter table public.quotes add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists discount numeric not null default 0;

-- ── B. issue_quotation_priced — บันทึกราคา/ส่วนลด + ออกเลขใบเสนอราคา ──────────
-- p_items: [{font_id, name, license_type, price}]  (จับคู่ font_id ฝั่ง client)
-- idempotent เรื่องเลข QT (ออกแล้วไม่กินเลขใหม่) แต่ยังอัปเดตราคา/ส่วนลดได้
-- ถ้า quote ถูกยืนยันรับชำระแล้ว (มี order) → ห้ามแก้ราคา
create or replace function public.issue_quotation_priced(
  p_quote_id uuid,
  p_items jsonb,
  p_discount numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote  quotes%rowtype;
  v_role   text := public.get_my_role()::text;
  v_item   jsonb;
  v_font_id uuid;
  v_price  numeric;
  v_sum    numeric := 0;
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_total  numeric;
  v_doc_no text;
  v_issued_at timestamptz;
  v_already boolean := false;
begin
  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'quote_not_found';
  end if;

  -- authz: admin หรือ designer เจ้าของ quote (coalesce กัน get_my_role() = null)
  if coalesce(v_role, '') <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
    raise exception 'not_authorized';
  end if;

  -- ยืนยันรับชำระแล้ว → ล็อกราคา ห้ามแก้
  if exists (select 1 from orders where quote_id = p_quote_id) then
    raise exception 'already_confirmed';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  -- ตรวจทุก item: font_id มีจริง + เป็นฟอนต์ของ designer เจ้าของ (ถ้าไม่ใช่ admin) + price >= 0
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
    v_sum := v_sum + v_price;
  end loop;

  v_total := greatest(v_sum - v_discount, 0);

  -- บันทึกราคา/ส่วนลดลง quote เสมอ (แก้ราคาซ้ำได้ตราบยังไม่ยืนยันชำระ)
  update quotes
  set fonts_detail = p_items,
      discount = v_discount,
      total_amount = v_total
  where id = p_quote_id;

  -- ออกเลข QT เฉพาะครั้งแรก (idempotent — ออกแล้วคืนเลขเดิม ไม่กินเลขจาก counter)
  if v_quote.quote_no is not null then
    v_doc_no := v_quote.quote_no;
    v_issued_at := v_quote.quote_issued_at;
    v_already := true;
  else
    v_doc_no := public.next_doc_no('QT');
    v_issued_at := now();
    update quotes
    set quote_no = v_doc_no, quote_issued_at = v_issued_at, issued_by = auth.uid()
    where id = p_quote_id;
  end if;

  return jsonb_build_object(
    'doc_no', v_doc_no,
    'issued_at', v_issued_at,
    'already_issued', v_already
  );
end;
$$;

revoke execute on function public.issue_quotation_priced(uuid, jsonb, numeric) from public, anon;
grant execute on function public.issue_quotation_priced(uuid, jsonb, numeric) to authenticated;

-- ── C. confirm_quote_paid — คิดส่วนลดจาก quote + ออกใบเสร็จ RC อะตอมมิก ───────
-- signature เดิม (p_quote_id, p_items) คงไว้ — ดึง discount จาก quote เอง
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
  v_item jsonb;
  v_font_id uuid;
  v_price numeric;
  v_sum numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_customer_user_id uuid;
  v_receipt_no text;
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

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
    v_sum := v_sum + v_price;
  end loop;

  -- ส่วนลดดึงจาก quote (ตั้งไว้ตอนออกใบเสนอราคา) — กัน client ส่งมั่ว
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
    p_items, v_total, v_discount, 'paid', now()
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

  -- ออกใบเสร็จ RC อัตโนมัติในขั้นตอนยืนยันชำระ (ถ้ายังไม่มี)
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
