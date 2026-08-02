-- ใบแจ้งหนี้ (Invoice) — เลขที่เอกสาร + ทางออกเลขสองเส้นทาง
--
-- ตัวเอกสารมีอยู่แล้วใน `quote-doc.ts` (`DOC_SPEC.invoice`) แต่ไม่มีที่ไหนออก "เลขที่"
-- ให้เลย migration นี้จึงเป็นทางเข้าของทั้งฟีเจอร์
--
-- **ใบแจ้งหนี้เป็นของเสริม ออกเฉพาะเมื่อลูกค้าขอ** (ลูกค้าส่งใบ PO มาแล้วขอใบแจ้งหนี้
-- เพื่อรอรับเงินตามรอบ) ตัวชี้ขาดมีตัวเดียวคือ `quotes.invoice_no is null` = ไม่มีใบแจ้งหนี้
-- → ฝั่งเว็บใช้ค่านี้ตัดสินทั้งการแนบไฟล์ ข้อความในอีเมล และปุ่มพิมพ์ ไม่มีธงตัวที่สอง
--
-- สองเส้นทางที่ออกเลขได้:
--  1. ตอนกดยืนยันรับชำระ — `confirm_quote_paid(..., p_issue_invoice => true)` ออก IV คู่กับ RC
--  2. ออกย้อนหลัง — `issue_quote_doc(id, 'invoice')` สำหรับใบที่ยืนยันไปแล้วแล้วลูกค้าเพิ่งขอ
-- ทั้งคู่ idempotent: มีเลขอยู่แล้วคืนเลขเดิม ไม่กิน counter

alter table public.quotes
  add column if not exists invoice_no text,
  add column if not exists invoice_issued_at timestamptz;

comment on column public.quotes.invoice_no is
  'เลขที่ใบแจ้งหนี้ (IV-xxxx-xxxx) — null = ลูกค้าไม่ได้ขอ จึงไม่มีใบแจ้งหนี้ในเอกสารชุดนี้';

create unique index if not exists quotes_invoice_no_key
  on public.quotes (invoice_no) where invoice_no is not null;

-- ── confirm_quote_paid: เพิ่ม p_issue_invoice ────────────────────────────────
-- ⚠️ ต้อง drop ตัวเดิมก่อน — `create or replace` ที่เพิ่มพารามิเตอร์ = สร้าง overload
-- ตัวใหม่ ของเดิมยังอยู่ แล้ว PostgREST ที่เรียกด้วยชื่ออาร์กิวเมนต์สองตัวจะเข้าได้ทั้งคู่
-- → `function is not unique` ทั้งที่โค้ดถูก · drop แล้ว grant หายด้วย ต้อง grant ใหม่ท้ายไฟล์
drop function if exists public.confirm_quote_paid(uuid, jsonb);

create or replace function public.confirm_quote_paid(
  p_quote_id uuid,
  p_items jsonb,
  p_issue_invoice boolean default false
)
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
  v_invoice_no text;
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

  -- ใบแจ้งหนี้ IV — เฉพาะเมื่อ designer ติ๊กขอ · แพตเทิร์นเดียวกับ RC ด้านบน
  -- (มีเลขอยู่แล้วใช้เลขเดิม) กดยืนยันซ้ำจึงไม่กินเลขจาก counter
  v_invoice_no := v_quote.invoice_no;
  if p_issue_invoice and v_invoice_no is null then
    v_invoice_no := public.next_doc_no('IV');
    update quotes
    set invoice_no = v_invoice_no, invoice_issued_at = now(), issued_by = auth.uid()
    where id = p_quote_id;
  end if;

  return to_jsonb(v_order)
       || jsonb_build_object('receipt_no', v_receipt_no, 'invoice_no', v_invoice_no);
end;
$$;

revoke execute on function public.confirm_quote_paid(uuid, jsonb, boolean) from public, anon;
grant execute on function public.confirm_quote_paid(uuid, jsonb, boolean) to authenticated;

-- ── issue_quote_doc: รองรับ 'invoice' (ออกย้อนหลัง) ──────────────────────────
-- signature เดิม ไม่ต้อง drop · โครงเดิมของ 0039 ทั้งหมด (authz + for update + idempotent)
create or replace function public.issue_quote_doc(p_quote_id uuid, p_doc_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote  quotes%rowtype;
  v_role   text;
  v_doc_no text;
  v_issued_at timestamptz;
begin
  if p_doc_type not in ('quotation', 'invoice', 'receipt') then
    raise exception 'invalid_doc_type';
  end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'quote_not_found';
  end if;

  -- authorization: admin หรือ designer เจ้าของ quote เท่านั้น
  -- coalesce สำคัญ: get_my_role() คืน null ได้ถ้า auth.uid() ไม่มีแถวใน users
  -- (เช่น user ถูกลบแต่ token ยังใช้ได้) — ถ้าไม่ coalesce, null <> 'admin' = null
  -- และ null AND true = null → if ไม่ทำงาน → หลุดผ่านการตรวจสิทธิ์
  v_role := public.get_my_role()::text;
  if coalesce(v_role, '') <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
    raise exception 'not_authorized';
  end if;

  -- ใบเสนอราคาต้องออกก่อนใบแจ้งหนี้/ใบเสร็จเสมอ
  if p_doc_type in ('invoice', 'receipt') and v_quote.quote_no is null then
    raise exception 'quote_required_first';
  end if;

  -- idempotent: เอกสารประเภทนี้ออกไปแล้ว → คืนเลขเดิม ไม่กินเลขจาก counter
  if p_doc_type = 'quotation' and v_quote.quote_no is not null then
    return jsonb_build_object(
      'doc_no', v_quote.quote_no,
      'issued_at', v_quote.quote_issued_at,
      'already_issued', true
    );
  end if;
  if p_doc_type = 'invoice' and v_quote.invoice_no is not null then
    return jsonb_build_object(
      'doc_no', v_quote.invoice_no,
      'issued_at', v_quote.invoice_issued_at,
      'already_issued', true
    );
  end if;
  if p_doc_type = 'receipt' and v_quote.receipt_no is not null then
    return jsonb_build_object(
      'doc_no', v_quote.receipt_no,
      'issued_at', v_quote.receipt_issued_at,
      'already_issued', true
    );
  end if;

  v_issued_at := now();

  if p_doc_type = 'quotation' then
    v_doc_no := public.next_doc_no('QT');
    update quotes
    set quote_no = v_doc_no, quote_issued_at = v_issued_at, issued_by = auth.uid()
    where id = p_quote_id;
  elsif p_doc_type = 'invoice' then
    v_doc_no := public.next_doc_no('IV');
    update quotes
    set invoice_no = v_doc_no, invoice_issued_at = v_issued_at, issued_by = auth.uid()
    where id = p_quote_id;
  else
    v_doc_no := public.next_doc_no('RC');
    update quotes
    set receipt_no = v_doc_no, receipt_issued_at = v_issued_at, issued_by = auth.uid()
    where id = p_quote_id;
  end if;

  return jsonb_build_object(
    'doc_no', v_doc_no,
    'issued_at', v_issued_at,
    'already_issued', false
  );
end;
$$;

revoke execute on function public.issue_quote_doc(uuid, text) from public, anon;
grant execute on function public.issue_quote_doc(uuid, text) to authenticated;
