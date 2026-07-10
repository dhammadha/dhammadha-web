-- Phase 2 ค้าง — ย้ายการออกเลข QT/RC จาก client (genDocNo ใน
-- src/app/admin/quotes/page.tsx สแกน list เอง) มาใช้ next_doc_no ฝั่ง DB
-- (0032_phase2_orders_entitlements.sql) ผ่าน RPC เดียวที่ atomic + กันกดซ้ำ
--
-- 1. seed doc_counters จากเลขที่ออกไปแล้วบน client กันชนกับเลขที่ next_doc_no
--    จะออกต่อจากนี้ (ต้องมากกว่าเลขสูงสุดที่มีอยู่จริงในแต่ละปี)
-- 2. issue_quote_doc(p_quote_id, p_doc_type) — admin เท่านั้น, idempotent,
--    receipt ต้องมี quote_no ก่อน (กติกาเดิมของหน้า UI)

-- ── 1. seed doc_counters จาก quote_no / receipt_no ที่มีอยู่ ──────────────────
-- รูปแบบเดิม: "QT-2569-0001" / "RC-2569-0001" — ดึงปี (พ.ศ.) + เลขลำดับ
-- แล้ว upsert last_no ให้เป็นค่ามากสุดต่อ (prefix, year) กันเลขใหม่ชนเลขเก่า

insert into public.doc_counters (prefix, year, last_no)
select
  m[1] as prefix,
  m[2]::int as year,
  max(m[3]::int) as last_no
from public.quotes q,
  lateral (
    select regexp_match(q.quote_no, '^(QT|RC)-(\d{4})-(\d+)$') as m
  ) s
where q.quote_no is not null and s.m is not null
group by m[1], m[2]::int
on conflict (prefix, year)
do update set last_no = greatest(public.doc_counters.last_no, excluded.last_no);

insert into public.doc_counters (prefix, year, last_no)
select
  m[1] as prefix,
  m[2]::int as year,
  max(m[3]::int) as last_no
from public.quotes q,
  lateral (
    select regexp_match(q.receipt_no, '^(QT|RC)-(\d{4})-(\d+)$') as m
  ) s
where q.receipt_no is not null and s.m is not null
group by m[1], m[2]::int
on conflict (prefix, year)
do update set last_no = greatest(public.doc_counters.last_no, excluded.last_no);

-- ── 2. issue_quote_doc — admin กด "ออกใบเสนอราคา" / "ออกใบเสร็จ" ────────────
-- แทนที่ genDocNo ฝั่ง client: ล็อกแถว quote (for update) + next_doc_no
-- (atomic ผ่าน doc_counters) กันสองแท็บ/สองคนกดพร้อมกันได้เลขซ้ำ
-- idempotent: กดซ้ำที่เอกสารออกไปแล้ว → คืนเลขเดิม ไม่เดินเลขใหม่

create function public.issue_quote_doc(p_quote_id uuid, p_doc_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_doc_no text;
  v_issued_at timestamptz;
begin
  -- coalesce สำคัญ: ถ้า auth.uid() ไม่มีแถวใน users get_my_role() คืน null
  -- และ null <> 'admin' ไม่เป็น true → จะหลุดผ่านการตรวจสิทธิ์
  -- (cast เป็น text ก่อน เพราะ get_my_role() คืน enum user_role)
  if coalesce(public.get_my_role()::text, '') <> 'admin' then
    raise exception 'not_authorized';
  end if;

  if p_doc_type not in ('quotation', 'receipt') then
    raise exception 'invalid_doc_type';
  end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'quote_not_found';
  end if;

  -- ใบเสนอราคาต้องออกก่อนใบเสร็จเสมอ (กติกาเดิมของ UI)
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

revoke execute on function public.issue_quote_doc(uuid, text) from public, anon;
grant execute on function public.issue_quote_doc(uuid, text) to authenticated;
