"use client";

// Modal "ยืนยันรับชำระ" — ยืนยันการชำระเงินของ quote → เรียก confirm_quote_paid
// (สร้าง order + entitlements + ออกเลขใบเสร็จ RC อัตโนมัติ) แล้วส่งผลกลับให้หน้า
// แม่ไปสร้าง PDF ใบเสร็จ + ส่งอีเมลแจ้งลูกค้าพร้อมลิงก์ดาวน์โหลด
//
// โหมดการทำงาน:
//  - priced: quote มี fonts_detail (font_id + ราคา) ครบ → แสดงสรุปอ่านอย่างเดียว
//    ยอดดึงจากใบเสนอราคาที่ออกแล้ว ไม่ให้แก้ (กันพลาด)
//  - legacy: quote เก่าที่ไม่มี fonts_detail → คงโหมดจับคู่ฟอนต์/กรอกราคาเองแบบเดิม
// ใช้ร่วมกันทั้งหน้า designer/quotes และ admin/quotes

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { licenseLabel } from "@/lib/license";
import Button from "@/components/Button";

type DetailItem = { name: string; price: number; license_type: string; font_id?: string | null };

export type ConfirmQuote = {
  id: string;
  contact_name: string;
  company_name: string;
  email: string;
  license_type: string;
  discount: number | null;
  fonts: string[];
  fonts_detail?: DetailItem[] | null;
  designer_id: string | null;
};

export type ConfirmResult = { orderId: string; orderNo: string; receiptNo: string | null };

type FontOption = { id: string; name: string | null; name_th: string | null; price: number | null };

type ItemRow = {
  quoteName: string;
  font_id: string;
  license_type: string;
  price: string; // เก็บเป็น string ระหว่างพิมพ์
};

interface Props {
  quote: ConfirmQuote;
  onClose: () => void;
  /** เรียกหลังยืนยันสำเร็จ — ส่ง order/receipt กลับให้หน้าแม่จัดการ PDF + อีเมล */
  onConfirmed: (result: ConfirmResult) => void;
}

function matchFont(quoteName: string, fonts: FontOption[]): string {
  const q = quoteName.trim().toLowerCase();
  const exact = fonts.find((f) => f.name?.toLowerCase() === q || f.name_th?.toLowerCase() === q);
  if (exact) return exact.id;
  const partial = fonts.find(
    (f) => (f.name && q.includes(f.name.toLowerCase())) || (f.name && f.name.toLowerCase().includes(q))
  );
  return partial?.id ?? "";
}

// quote มีราคาเก็บไว้ครบแล้วหรือยัง (ออกใบเสนอราคาผ่าน issue_quotation_priced)
function isPriced(quote: ConfirmQuote): boolean {
  const d = quote.fonts_detail;
  return !!d && d.length > 0 && d.every((it) => !!it.font_id && Number(it.price) >= 0);
}

export default function ConfirmPaidModal({ quote, onClose, onConfirmed }: Props) {
  const priced = isPriced(quote);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // priced: สร้างแถวจาก fonts_detail ที่บันทึกไว้ (อ่านอย่างเดียว) — ไม่ต้องโหลดฟอนต์
    if (priced) {
      setRows(
        (quote.fonts_detail ?? []).map((d) => ({
          quoteName: d.name,
          font_id: d.font_id ?? "",
          license_type: d.license_type,
          price: String(d.price ?? 0),
        }))
      );
      return;
    }
    // legacy: โหลดฟอนต์แล้วจับคู่ + ให้กรอกราคาเอง
    (async () => {
      let q = supabase.from("fonts").select("id, name, name_th, price").order("name");
      if (quote.designer_id) q = q.eq("owner_id", quote.designer_id);
      const { data } = await q;
      const list = (data as FontOption[]) ?? [];
      setFonts(list);
      setRows(
        quote.fonts.map((name) => {
          const fontId = matchFont(name, list);
          const fallbackPrice = list.find((f) => f.id === fontId)?.price;
          return {
            quoteName: name,
            font_id: fontId,
            license_type: quote.license_type,
            price: String(fallbackPrice ?? 0),
          };
        })
      );
    })();
  }, [quote, priced]);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + (Number(r.price) || 0), 0), [rows]);
  const discountNum = Math.max(Number(quote.discount) || 0, 0);
  const net = Math.max(subtotal - discountNum, 0);
  const ready = rows.length > 0 && rows.every((r) => r.font_id && Number(r.price) >= 0);

  const confirm = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const items = rows.map((r) => ({
      font_id: r.font_id,
      name: r.quoteName,
      license_type: r.license_type,
      price: Number(r.price) || 0,
    }));
    const { data, error: rpcError } = await supabase.rpc("confirm_quote_paid", {
      p_quote_id: quote.id,
      p_items: items,
    });
    if (rpcError) {
      const msg = rpcError.message.includes("already_confirmed")
        ? "ใบเสนอราคานี้ยืนยันรับชำระไปแล้ว"
        : rpcError.message.includes("forbidden")
        ? "คุณไม่มีสิทธิ์ยืนยันใบเสนอราคานี้"
        : `ยืนยันไม่สำเร็จ: ${rpcError.message}`;
      setError(msg);
      setSaving(false);
      return;
    }

    const order = data as { id?: string; order_no?: string; receipt_no?: string } | null;
    setSaving(false);
    onConfirmed({
      orderId: order?.id ?? "",
      orderNo: order?.order_no ?? "",
      receiptNo: order?.receipt_no ?? null,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-[17px] font-semibold text-navy">ยืนยันรับชำระ</h3>
          <button onClick={onClose} className="text-[#aaa] hover:text-navy bg-transparent border-none cursor-pointer text-lg leading-none">✕</button>
        </div>
        <p className="text-[13px] text-[#888] mb-4">
          {quote.company_name || quote.contact_name} · {quote.email}
        </p>
        <div className="text-[12px] text-[#888] bg-[#f8f8f6] rounded-lg p-3 mb-4">
          ยืนยันเมื่อได้รับเงินโอนเข้าบัญชีของคุณแล้วเท่านั้น — ระบบจะออกใบเสร็จ เปิดสิทธิ์ดาวน์โหลด
          และส่งอีเมลแจ้งลูกค้าพร้อมไฟล์ใบเสร็จทันที (ไฟล์ถูกประทับข้อมูลการซื้อ ยกเลิกภายหลังไม่ได้)
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {rows.map((row, i) => (
            <div key={i} className="border border-border rounded-xl p-3">
              <div className="text-[13px] font-medium text-navy mb-2">
                {row.quoteName}
                <span className="text-[#aaa] font-normal"> · {licenseLabel(row.license_type)}</span>
              </div>
              {priced ? (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#888]">ราคา</span>
                  <span className="text-[13px] text-navy">฿{(Number(row.price) || 0).toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={row.font_id}
                    onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, font_id: e.target.value } : r)))}
                    className="flex-1 text-[13px] border border-border rounded-lg px-2 py-2 bg-white text-navy"
                  >
                    <option value="">— เลือกฟอนต์ในระบบ —</option>
                    {fonts.map((f) => (
                      <option key={f.id} value={f.id}>{f.name ?? f.name_th ?? f.id}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] text-[#aaa]">฿</span>
                    <input
                      type="number"
                      min="0"
                      value={row.price}
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))}
                      className="w-[100px] text-[13px] border border-border rounded-lg px-2 py-2 text-right text-navy"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 mb-4">
          {discountNum > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#555]">รวมจำนวนเงิน</span>
                <span className="text-[14px] text-navy">฿{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#555]">ส่วนลด</span>
                <span className="text-[14px] text-red-500">-฿{discountNum.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#555]">ยอดรวม</span>
            <span className="text-[16px] font-semibold text-navy">฿{net.toLocaleString()}</span>
          </div>
        </div>

        {error && <p className="text-[13px] text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={confirm} disabled={!ready || saving}>
            {saving ? "กำลังบันทึก…" : "ยืนยันรับชำระ + ส่งไฟล์ให้ลูกค้า"}
          </Button>
        </div>
      </div>
    </div>
  );
}
