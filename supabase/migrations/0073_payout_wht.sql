-- ภาษีหัก ณ ที่จ่ายในการโอนส่วนแบ่ง + เลขที่เอกสาร
--
-- `/designer-agreement` ข้อ 6 ประกาศว่าเมื่อแพลตฟอร์มเป็นนิติบุคคล จะหักภาษี
-- ณ ที่จ่าย 3% และออกใบ 50 ทวิให้ทุกงวด — ตารางเดิมเก็บได้แค่ยอดเดียว
--
-- ⚠️ **`amount` ยังคงเป็นยอดเต็ม (gross)** ไม่ใช่ยอดที่โอนจริง
-- เหตุผล: ใบ 50 ทวิบังคับให้ระบุ "จำนวนเงินที่จ่าย" คู่กับ "ภาษีที่หัก"
-- ถ้าเก็บแค่ยอดสุทธิจะออกใบไม่ได้ และยอด "จ่ายแล้วรวม" จะต่ำกว่าภาระที่ปลดจริง
-- (เราปลดหนี้ ฿10,000 โดยโอน ฿9,700 + นำส่งสรรพากร ฿300 แทน designer)
-- แถวเดิมทั้งหมดเกิดก่อนมีการหักภาษี → gross = net อยู่แล้ว ไม่ต้องแปลงข้อมูล

-- ── 1) คอลัมน์ใหม่ ──────────────────────────────────────────────────────────

alter table public.payouts
  add column doc_no text unique,              -- PO-2569-0001 (ใบสรุปการโอน)
  add column wht_cert_no text unique,         -- WT-2569-0001 (ใบ 50 ทวิ) null เมื่อไม่หักภาษี
  add column wht_rate numeric not null default 0
    check (wht_rate >= 0 and wht_rate <= 0.1),
  add column wht_amount numeric not null default 0 check (wht_amount >= 0),
  add column net_amount numeric;

update public.payouts set net_amount = amount where net_amount is null;

alter table public.payouts alter column net_amount set not null;

-- ── 2) RPC บันทึกการโอน ─────────────────────────────────────────────────────
--
-- เดิมหน้า admin `insert into payouts` ตรง ๆ ซึ่งเรียก next_doc_no() ไม่ได้
-- (ถูก revoke จาก client ใน 0032 เพื่อกันเลขไหลทิ้ง) จึงต้องผ่าน RPC
--
-- **ไม่เชื่อ wht_amount/net_amount ที่ client ส่งมา** — รับแค่ยอดเต็มกับอัตรา
-- แล้วคำนวณเองในนี้ ทั้งสามตัวเลขจะได้ตรงกับที่พิมพ์บนเอกสารเสมอ

create function public.record_payout(
  p_designer_id uuid,
  p_period_year int,
  p_period_quarter int,
  p_amount numeric,
  p_wht_rate numeric default 0,
  p_note text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wht numeric;
  v_row public.payouts;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  if p_wht_rate is null or p_wht_rate < 0 or p_wht_rate > 0.1 then
    raise exception 'wht_rate out of range' using errcode = '22023';
  end if;

  if p_period_quarter not between 1 and 4 then
    raise exception 'quarter must be 1-4' using errcode = '22023';
  end if;

  -- ปัดสองตำแหน่งให้ตรงกับ round2() ฝั่ง TypeScript (src/lib/revenue.ts)
  v_wht := round(p_amount * p_wht_rate, 2);

  insert into public.payouts (
    designer_id, period_year, period_quarter, amount, note,
    doc_no, wht_cert_no, wht_rate, wht_amount, net_amount
  )
  values (
    p_designer_id, p_period_year, p_period_quarter, round(p_amount, 2), p_note,
    public.next_doc_no('PO'),
    -- ไม่หักภาษี = ไม่มีใบ 50 ทวิ จึงไม่ควรกินเลขในซีรีส์ WT
    case when v_wht > 0 then public.next_doc_no('WT') end,
    p_wht_rate, v_wht, round(p_amount, 2) - v_wht
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- unique (designer_id, period_year, period_quarter) เดิมยังทำงาน → กดบันทึกซ้ำ
-- ยังคืน 23505 ให้หน้า admin แสดง "มีการบันทึกไปแล้ว" เหมือนเดิม
revoke execute on function public.record_payout(uuid, int, int, numeric, numeric, text)
  from public, anon;
grant execute on function public.record_payout(uuid, int, int, numeric, numeric, text)
  to authenticated;
