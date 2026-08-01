-- ใบเสร็จรับเงินสำหรับการซื้อรายชุด (Retail)
--
-- ก่อนหน้านี้เลข `RC` ออกเฉพาะเส้นทางใบเสนอราคา (`issue_quote_doc`, `confirm_quote_paid`)
-- ลูกค้าที่กดซื้อผ่าน Stripe จึงไม่ได้เอกสารทางบัญชีเลยสักใบ ทั้งที่หน้าเว็บประกาศว่า
-- "ยังไม่จด VAT — ออกใบเสร็จรับเงิน"
--
-- **ผู้ออกใบเสร็จของการขายรายชุด = แพลตฟอร์ม ไม่ใช่ designer**
-- ตรงกับฐานะตัวการ (principal) ที่เคาะไว้ใน `/terms` ข้อ 4 และ `/designer-agreement` ข้อ 4
-- (ต่างจากใบเสร็จของใบเสนอราคา ซึ่งออกในนาม designer เพราะเงินเข้า designer ตรง)
--
-- ทำไมใช้ทริกเกอร์แทนการแก้ `create_checkout_order_multi`:
-- ฟังก์ชันนั้นยาว ~150 บรรทัดและเป็นหัวใจของเส้นทางเงิน การ `create or replace` ทั้งก้อน
-- เพื่อเพิ่มฟิลด์เดียวมีโอกาสพิมพ์ตกมากกว่าที่ได้ · ทริกเกอร์ยังครอบทุกทางที่สร้าง
-- ออเดอร์รายชุดในอนาคตด้วย ไม่ต้องไล่แก้ทีละที่

alter table public.orders add column if not exists receipt_no text;

comment on column public.orders.receipt_no is
  'เลขที่ใบเสร็จรับเงินของการขายรายชุด (RC-xxxx-xxxx) — ออกอัตโนมัติตอนสร้างออเดอร์ที่จ่ายแล้ว · ออเดอร์ที่มาจากใบเสนอราคา (quote_id ไม่ null) ไม่ใช้คอลัมน์นี้ เพราะเลขใบเสร็จอยู่บน quotes';

-- กันเลขซ้ำ (unique แบบ partial เพราะแถวเก่า/ออเดอร์ใบเสนอราคาเป็น null ได้หลายแถว)
create unique index if not exists orders_receipt_no_key
  on public.orders (receipt_no) where receipt_no is not null;

-- ── ออกเลขอัตโนมัติตอน insert ────────────────────────────────────────────────
-- เงื่อนไข `quote_id is null` = เฉพาะการขายรายชุด · ออเดอร์จากใบเสนอราคามีเลขใบเสร็จ
-- ของตัวเองอยู่บนตาราง quotes แล้ว ถ้าออกซ้ำที่นี่จะกลายเป็นสองเลขต่อการซื้อครั้งเดียว
create or replace function public.set_retail_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.receipt_no is null and new.status = 'paid' and new.quote_id is null then
    new.receipt_no := public.next_doc_no('RC');
  end if;
  return new;
end;
$$;

revoke execute on function public.set_retail_receipt_no() from public, anon, authenticated;

drop trigger if exists orders_set_retail_receipt_no on public.orders;
create trigger orders_set_retail_receipt_no
  before insert on public.orders
  for each row execute function public.set_retail_receipt_no();
