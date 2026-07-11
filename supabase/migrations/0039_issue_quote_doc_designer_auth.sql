-- 0039: ขยายสิทธิ issue_quote_doc ให้ designer เจ้าของ quote ออกเอกสารเองได้
-- เดิม 0035 ให้เฉพาะ admin — ตอนนี้หน้า /designer/quotes ให้ designer ออก
-- ใบเสนอราคา/ใบเสร็จของงาน B2B ตัวเองได้ (ตามโมเดลธุรกิจ: quote เป็นเครื่องมือ
-- ให้ designer จัดการงานองค์กรเอง) → RPC ต้องอนุญาต admin หรือ designer เจ้าของ
--
-- ยังคง atomic (for update + next_doc_no), idempotent, และกติกา receipt-ต้องมี-
-- quote-ก่อน เหมือนเดิม

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
  if p_doc_type not in ('quotation', 'receipt') then
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
  -- (cast ::text เพราะ get_my_role() คืน enum user_role) — บทเรียนเดียวกับ 0036
  v_role := public.get_my_role()::text;
  if coalesce(v_role, '') <> 'admin' and v_quote.designer_id is distinct from auth.uid() then
    raise exception 'not_authorized';
  end if;

  -- ใบเสนอราคาต้องออกก่อนใบเสร็จเสมอ
  if p_doc_type = 'receipt' and v_quote.quote_no is null then
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

-- create or replace รักษา grant เดิมจาก 0035 (authenticated เท่านั้น) ไว้แล้ว
-- assert ซ้ำให้ชัดเจน: client role อื่นเรียกไม่ได้ การตรวจสิทธิ์จริงอยู่ในตัวฟังก์ชัน
revoke execute on function public.issue_quote_doc(uuid, text) from public, anon;
grant execute on function public.issue_quote_doc(uuid, text) to authenticated;
