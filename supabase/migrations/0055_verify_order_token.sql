-- 🔴 verify_order(p_order_no) เดิม anon เรียกได้ + order_no เดินเลขลำดับ
-- (OR-2569-0001, -0002, ... ผ่าน next_doc_no('OR') ใน 0032) — ใครก็วนลูปเดาเลขคำสั่งซื้อ
-- ทุกใบที่จ่ายแล้วได้หมด ได้ paid_at + ชื่อฟอนต์ + ชื่อลูกค้าแบบ mask ของทุกออเดอร์ในระบบ
-- (รั่วข้อมูลยอดขาย/ลูกค้าแม้จะ mask ชื่อแล้วก็ตาม)
--
-- แก้ด้วยการเพิ่มคอลัมน์ verify_token (random 16 bytes = 32 hex char, เดาไม่ได้ในทางปฏิบัติ)
-- แล้วเปลี่ยน verify_order ให้ค้นด้วย token แทน order_no ที่เดาง่าย
--
-- ⚠️ ของเดิมที่ประทับ URL แบบ ?order=OR-xxxx-xxxx ไปแล้ว (ถ้ามี) จะตรวจสอบไม่ได้อีกต่อไป
-- แต่ยืนยันกับทีมแล้วว่ายังไม่มีลูกค้าจริง มีแต่ข้อมูลทดสอบ — เลือกออกแบบให้สะอาด
-- (บังคับ token ทุกออเดอร์) แทนที่จะทำ compatibility shim รองรับเลขเก่า

-- ── 1. เพิ่มคอลัมน์ + backfill (update ให้ evaluate ต่อแถว เลขจะไม่ซ้ำกัน) ──────────
alter table public.orders add column verify_token text;

update public.orders
set verify_token = encode(gen_random_bytes(16), 'hex')
where verify_token is null;

alter table public.orders alter column verify_token set default encode(gen_random_bytes(16), 'hex');
alter table public.orders alter column verify_token set not null;
alter table public.orders add constraint orders_verify_token_key unique (verify_token);

-- ── 2. verify_order — ค้นด้วย token แทน order_no ──────────────────────────────
-- รูปแบบ/masking เดิมทั้งหมดเหมือนเดิม เปลี่ยนแค่คีย์ค้นหา
-- ต้อง drop ก่อน: create or replace เปลี่ยนชื่อ parameter ไม่ได้ (p_order_no → p_token)
-- Postgres จะฟ้อง "cannot change name of input parameter"
drop function if exists public.verify_order(text);

create function public.verify_order(p_token text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_order orders%rowtype;
  v_name text;
begin
  select * into v_order
  from orders
  where verify_token = p_token and status = 'paid';
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
$function$;

-- ยังต้องเป็น anon-callable เหมือนเดิม (หน้า /verify เป็นหน้าสาธารณะโดยตั้งใจ) แต่ตั้ง
-- revoke/grant ใหม่อย่างจงใจแทนที่จะปล่อยตาม default ของ PUBLIC ที่ postgres ให้อัตโนมัติ
revoke execute on function public.verify_order(text) from public;
grant execute on function public.verify_order(text) to anon, authenticated;
