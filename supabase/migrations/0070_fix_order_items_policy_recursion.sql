-- 0070: แก้ policy วนซ้ำ + ปิดช่องที่นักออกแบบเห็นยอดรวมของใบที่ซื้อข้ามร้าน
--
-- ปัญหาจาก 0069: policy "designer read orders with own items" บน orders ไป select
-- order_items ส่วน policy ของ order_items ก็ select orders กลับ → Postgres เจอ
-- "infinite recursion detected in policy for relation order_items" แล้ว **ทุก query
-- ที่แตะ orders พังหมด** (/account, /admin/orders, รายได้, payouts)
--
-- ทางแก้: ตัด policy ฝั่ง orders ทิ้ง (ต้นเหตุการวน) แล้วให้นักออกแบบดึงใบที่ซื้อ
-- ข้ามร้านผ่าน RPC security definer ที่คืน **เฉพาะยอดของตัวเอง** แทน — ได้ผลพลอยได้
-- คือปิดช่องที่เดิมนักออกแบบมองเห็น orders.total_amount ของทั้งใบ (รวมของคนอื่น)
--
-- บทเรียนที่ต้องจำ: policy ของสองตารางห้ามอ้างถึงกันไปกลับ ถ้าจำเป็นต้องข้ามตาราง
-- ให้ผ่านฟังก์ชัน security definer แทน (เหมือน get_my_role)

drop policy if exists "designer read orders with own items" on public.orders;

-- ใบที่มีรายการของเราแต่ไม่ใช่ใบของเราคนเดียว (ตะกร้าข้ามร้าน)
-- ยอดที่คืนเป็นผลรวมเฉพาะรายการของ auth.uid() เท่านั้น ไม่มียอดของนักออกแบบคนอื่น
create function public.designer_shared_orders()
returns table (
  id uuid,
  order_no text,
  status text,
  paid_at timestamptz,
  created_at timestamptz,
  source text,
  customer_name text,
  customer_email text,
  total_amount numeric,
  platform_amount numeric,
  designer_amount numeric,
  items jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    o.id,
    o.order_no,
    o.status,
    o.paid_at,
    o.created_at,
    o.source,
    o.customer_name,
    o.customer_email,
    round(sum(i.price), 2),
    round(sum(i.platform_amount), 2),
    round(sum(i.designer_amount), 2),
    jsonb_agg(jsonb_build_object(
      'font_id', i.font_id,
      'name', i.name,
      'license_type', i.license_type,
      'price', i.price
    ) order by i.created_at)
  from public.orders o
  join public.order_items i on i.order_id = o.id
  where i.designer_id = auth.uid()
    and (o.designer_id is null or o.designer_id <> auth.uid())
  group by o.id;
$$;

-- Postgres grant execute ให้ PUBLIC อัตโนมัติ — ต้อง revoke ก่อนเสมอ
revoke execute on function public.designer_shared_orders() from public, anon;
grant execute on function public.designer_shared_orders() to authenticated;
