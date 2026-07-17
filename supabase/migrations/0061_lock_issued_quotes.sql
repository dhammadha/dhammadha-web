-- ห้ามลบใบเสนอราคาที่ออกใบเสร็จรับเงินแล้ว
--
-- ปัญหา: เลขเอกสาร quote_no (QT) / receipt_no (RC) เก็บอยู่บน "ตาราง quotes"
-- ไม่ใช่ orders → ลบ quote ที่ออกใบเสร็จแล้วจะเสียหายเชิงบัญชี:
--   1) เลขใบเสร็จหายจากระบบ ทั้งที่ออกให้ลูกค้าไปแล้ว
--   2) order ยังอยู่ (0032: quote_id ... on delete set null) แต่ quote_id เป็น null
--      → ตามรอยจากออเดอร์กลับไปหาเอกสารไม่ได้อีก
--   3) doc_counters เดินหน้าต่อ → เลขนั้นขาดหายถาวร ไม่ถูกใช้ซ้ำ
--
-- policy ปัจจุบันบน quotes (permissive ทั้งคู่ → ถูก OR กัน):
--   "admin full access quotes"   cmd=*  using (get_my_role() = 'admin')
--   "designer delete own quotes" cmd=d  using (designer_id = auth.uid())
-- การเพิ่ม policy แบบ permissive อีกตัวจึงไม่ช่วยอะไร (OR กันแล้วยิ่งเปิดกว้าง)
-- ต้องใช้ `as restrictive` ซึ่งถูก AND กับทุก policy → บล็อกได้ทั้ง admin และ designer
-- ด้วยกฎเดียว และครอบ path ที่จะเพิ่มมาในอนาคตด้วยโดยอัตโนมัติ
--
-- หมายเหตุ: quote ที่ยังไม่ออกใบเสร็จ (receipt_no is null) ยังลบได้ตามเดิม
-- ทั้ง admin และ designer เจ้าของ — ไม่กระทบ flow ที่ทดสอบผ่านแล้ว

drop policy if exists "no delete issued quotes" on public.quotes;
create policy "no delete issued quotes"
  on public.quotes as restrictive for delete
  using (receipt_no is null);
