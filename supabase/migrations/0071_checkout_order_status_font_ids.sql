-- 0071: checkout_order_status คืน font_ids ด้วย
--
-- หน้า /checkout/success ต้องรู้ว่าใบนี้มีฟอนต์อะไรบ้าง เพื่อ **เอาออกจากตะกร้า**
-- หลังจ่ายเงินสำเร็จ (เดิมคืนแต่ชื่อฟอนต์ซึ่งเอาไปจับคู่กับ id ในตะกร้าไม่ได้)
-- ตั้งใจลบเฉพาะฟอนต์ในใบนี้ ไม่ใช่ล้างตะกร้าทั้งใบ เผื่อกรณีเปิดลิงก์ success เก่า
-- ค้างไว้แล้วในตะกร้ามีของใหม่ที่ยังไม่ได้จ่าย

create or replace function public.checkout_order_status(p_session_id text)
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
    'fonts', (select jsonb_agg(i ->> 'name') from jsonb_array_elements(v_order.items) i),
    'font_ids', (select jsonb_agg(i ->> 'font_id') from jsonb_array_elements(v_order.items) i)
  );
end;
$$;

grant execute on function public.checkout_order_status(text) to anon, authenticated;
